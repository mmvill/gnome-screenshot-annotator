/**
 * annotatorPanel.js — v1.0
 *
 * Inyecta herramientas de anotación en el panel de captura nativo de GNOME Shell.
 * Solo visible en modo Selección y Pantalla completa.
 * Se oculta automáticamente en modo Ventana y Grabar.
 */

import Clutter   from 'gi://Clutter';
import St        from 'gi://St';
import GLib      from 'gi://GLib';
import Gio       from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import Cairo     from 'gi://cairo';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

const TOOLS = [
    {id:'highlight', icon:'highlight-annotator-symbolic', tooltip:'Marcador — resaltar área'},
    {id:'rect',      icon:'rect-annotator-symbolic',      tooltip:'Rectángulo — arrastra para dibujar'},
    {id:'circle',    icon:'circle-annotator-symbolic',    tooltip:'Elipse — arrastra para dibujar'},
    {id:'arrow',     icon:'arrow-annotator-symbolic',     tooltip:'Flecha — arrastra para dibujar'},
    {id:'text',      icon:'text-annotator-symbolic',      tooltip:'Texto — clic, escribe, Enter para confirmar'},
    {id:'pixelate',  icon:'pixelate-annotator-symbolic',  tooltip:'Pixelado — arrastra para censurar área'},
];

const COLORS = [
    {r:1.0,g:0.85,b:0.0,a:0.5, css:'#ffdd00',label:'Amarillo'},
    {r:1.0,g:0.2, b:0.2,a:0.9, css:'#ff3333',label:'Rojo'},
    {r:0.2,g:0.5, b:1.0,a:0.9, css:'#3380ff',label:'Azul'},
    {r:0.2,g:0.8, b:0.2,a:0.9, css:'#33cc33',label:'Verde'},
    {r:1.0,g:1.0, b:1.0,a:0.9, css:'#ffffff',label:'Blanco'},
    {r:0.0,g:0.0, b:0.0,a:0.9, css:'#111111',label:'Negro'},
];
const WIDTHS = [{v:2,label:'Fino'},{v:4,label:'Medio'},{v:8,label:'Grueso'}];

export class AnnotatorPanel {
    constructor(ui, settings, extPath) {
        this._ui = ui; this._settings = settings; this._extPath = extPath;
        this._strokes = []; this._currentStroke = null; this._isDrawing = false;
        this._activeTool = null; this._color = COLORS[0]; this._width = 4;
        this._row = null; this._drawArea = null; this._textEntry = null;
        this._tooltips = []; this._colorBtns = []; this._widthBtns = [];
        this._toolBtns = {}; this._modeSignals = [];
    }

    inject() {
        try { this._width = this._settings?.get_int('default-stroke-width') ?? 4; } catch(_e){}
        this._buildRow();
        this._buildDrawArea();
        this._connectModeSignals();
        // Establecer visibilidad inicial
        this._updateVisibility();
    }

    reset() {
        this._strokes = []; this._currentStroke = null; this._isDrawing = false;
        if (this._textEntry) { this._textEntry.destroy(); this._textEntry = null; }
        this._deactivateTool();
        this._drawArea?.queue_repaint();
        this._updateVisibility();
    }

    destroy() {
        // Desconectar señales de modo
        for (const {obj, id} of this._modeSignals) {
            try { obj.disconnect(id); } catch(_e){}
        }
        this._modeSignals = [];
        if (this._textEntry) { this._textEntry.destroy(); this._textEntry = null; }
        this._deactivateTool();
        for (const t of this._tooltips) {
            try { this._ui.remove_child(t); t.destroy(); } catch(_e){}
        }
        this._tooltips = [];
        if (this._row) {
            try { this._ui._panel?.remove_child(this._row); } catch(_e){}
            this._row.destroy(); this._row = null;
        }
        if (this._drawArea) {
            try { this._ui.remove_child(this._drawArea); } catch(_e){}
            this._drawArea.destroy(); this._drawArea = null;
        }
    }

    getStrokes() { return [...this._strokes]; }

    // ── Visibilidad según modo ─────────────────────────────────────────────

    /**
     * La barra de anotación solo tiene sentido en modo Selección y Pantalla.
     * En modo Ventana o Grabar se oculta y se desactiva la herramienta activa.
     */
    _isAnnotationMode() {
        try {
            // Modo screenshot (no screencast) + selección o pantalla completa
            const shotMode = this._ui._shotButton?.checked ?? true;
            const winMode  = this._ui._windowButton?.checked ?? false;
            return shotMode && !winMode;
        } catch(_e) { return true; }
    }

    _updateVisibility() {
        const show = this._isAnnotationMode();
        if (this._row) this._row.visible = show;
        if (!show) {
            // Ocultar canvas y desactivar herramienta al salir del modo anotación
            if (this._drawArea) this._drawArea.reactive = false;
            this._deactivateTool();
        }
    }

    _connectModeSignals() {
        // Observar cambios de modo: ventana, pantalla, selección, shot/cast
        const watchBtn = (btn, label) => {
            if (!btn) return;
            try {
                const id = btn.connect('notify::checked', () => {
                    this._updateVisibility();
                    this._ui.grab_key_focus();
                });
                this._modeSignals.push({obj: btn, id});
            } catch(_e) {}
        };

        watchBtn(this._ui._selectionButton, 'selection');
        watchBtn(this._ui._screenButton,    'screen');
        watchBtn(this._ui._windowButton,    'window');
        watchBtn(this._ui._shotButton,      'shot');
        watchBtn(this._ui._castButton,      'cast');
    }

    // ── Fila de herramientas ───────────────────────────────────────────────

    _buildRow() {
        this._row = new St.BoxLayout({
            style_class: 'screenshot-ui-annotator-row',
            x_align: Clutter.ActorAlign.CENTER,
        });

        for (const t of TOOLS) {
            const btn = new St.Button({
                style_class: 'screenshot-ui-type-button screenshot-ui-annotator-tool',
                toggle_mode: true, can_focus: false, child: this._makeIcon(t.icon),
            });
            this._addTip(btn, t.tooltip);
            btn.connect('clicked', () => this._toggleTool(t.id, btn));
            this._row.add_child(btn);
            this._toolBtns[t.id] = btn;
        }

        this._row.add_child(this._sep());

        for (const c of COLORS) {
            const btn = new St.Button({
                style_class: 'screenshot-ui-annotator-color',
                style: `background-color:${c.css};`, can_focus: false,
            });
            this._addTip(btn, c.label);
            btn.connect('clicked', () => {
                this._color = c;
                this._colorBtns.forEach(b => b.remove_style_pseudo_class('checked'));
                btn.add_style_pseudo_class('checked');
                this._ui.grab_key_focus();
            });
            this._row.add_child(btn); this._colorBtns.push(btn);
        }
        if (this._colorBtns[0]) this._colorBtns[0].add_style_pseudo_class('checked');

        this._row.add_child(this._sep());

        for (const w of WIDTHS) {
            const btn = new St.Button({
                style_class: 'screenshot-ui-annotator-width',
                label: w.label, can_focus: false,
            });
            this._addTip(btn, `Grosor ${w.v}px`);
            btn.connect('clicked', () => {
                this._width = w.v;
                this._widthBtns.forEach(b => b.remove_style_pseudo_class('checked'));
                btn.add_style_pseudo_class('checked');
                this._ui.grab_key_focus();
            });
            if (w.v === this._width) btn.add_style_pseudo_class('checked');
            this._row.add_child(btn); this._widthBtns.push(btn);
        }

        this._row.add_child(this._sep());

        const undo = this._sysBtn('edit-undo-symbolic', 'Deshacer último trazo');
        undo.connect('clicked', () => { this._undo(); this._ui.grab_key_focus(); });
        this._row.add_child(undo);

        const clr = this._sysBtn('edit-clear-all-symbolic', 'Borrar todas las anotaciones');
        clr.connect('clicked', () => {
            this._strokes = []; this._drawArea?.queue_repaint();
            this._ui.grab_key_focus();
        });
        this._row.add_child(clr);

        this._ui._panel.insert_child_below(this._row, this._ui._bottomRowContainer);
    }

    _makeIcon(name) {
        try {
            const f = Gio.File.new_for_path(`${this._extPath}/icons/${name}.svg`);
            return new St.Icon({gicon: new Gio.FileIcon({file: f}), icon_size: 16});
        } catch(_e) { return new St.Icon({icon_name: 'image-missing', icon_size: 16}); }
    }

    _sysBtn(icon, tip) {
        const btn = new St.Button({
            style_class: 'screenshot-ui-type-button screenshot-ui-annotator-tool',
            can_focus: false, child: new St.Icon({icon_name: icon, icon_size: 16}),
        });
        this._addTip(btn, tip); return btn;
    }

    _addTip(btn, text) {
        try {
            const tip = new Screenshot.Tooltip(btn, {text, style_class:'screenshot-ui-tooltip', visible:false});
            this._ui.add_child(tip); this._tooltips.push(tip);
        } catch(_e) {}
    }

    _sep() { return new St.Widget({style_class:'screenshot-ui-annotator-sep', width:1, height:24}); }

    // ── DrawArea ───────────────────────────────────────────────────────────

    _buildDrawArea() {
        const W = global.stage.width, H = global.stage.height;
        this._drawArea = new St.DrawingArea({width:W, height:H, reactive:false});
        this._drawArea.connect('repaint', a => {
            const c = a.get_context(); this._paint(c); c.$dispose();
        });
        this._drawArea.connect('button-press-event',   (_a,e) => this._onPress(e));
        this._drawArea.connect('motion-event',         (_a,e) => this._onMotion(e));
        this._drawArea.connect('button-release-event', (_a,e) => this._onRelease(e));
        const ch = this._ui.get_children();
        const idx = ch.indexOf(this._ui._primaryMonitorBin);
        this._ui.insert_child_at_index(this._drawArea, idx > 0 ? idx : ch.length);
    }

    // ── Herramientas ───────────────────────────────────────────────────────

    _toggleTool(id, btn) {
        if (this._activeTool === id) { this._deactivateTool(); return; }
        if (this._textEntry) { this._textEntry.destroy(); this._textEntry = null; }
        if (this._activeTool && this._toolBtns[this._activeTool])
            this._toolBtns[this._activeTool].checked = false;
        this._activeTool = id; btn.checked = true; this._drawArea.reactive = true;
        this._ui.grab_key_focus();
    }

    _deactivateTool() {
        if (this._activeTool && this._toolBtns[this._activeTool])
            this._toolBtns[this._activeTool].checked = false;
        this._activeTool = null;
        if (this._drawArea) this._drawArea.reactive = false;
        try { this._ui.grab_key_focus(); } catch(_e) {}
    }

    _undo() { if (this._strokes.length) { this._strokes.pop(); this._drawArea?.queue_repaint(); } }

    // ── Eventos ────────────────────────────────────────────────────────────

    _onPress(e) {
        if (!this._activeTool) return Clutter.EVENT_PROPAGATE;
        const [x,y] = e.get_coords();
        if (this._textEntry) { this._commitText(); return Clutter.EVENT_STOP; }
        if (this._activeTool === 'text') { this._startText(x,y); return Clutter.EVENT_STOP; }
        this._isDrawing = true;
        this._currentStroke = {tool:this._activeTool, color:{...this._color}, width:this._width, x1:x,y1:y,x2:x,y2:y};
        return Clutter.EVENT_STOP;
    }

    _onMotion(e) {
        if (!this._isDrawing || !this._currentStroke) return Clutter.EVENT_PROPAGATE;
        const [x,y] = e.get_coords();
        this._currentStroke.x2 = x; this._currentStroke.y2 = y;
        this._drawArea?.queue_repaint(); return Clutter.EVENT_STOP;
    }

    _onRelease(e) {
        if (!this._isDrawing || !this._currentStroke) return Clutter.EVENT_PROPAGATE;
        const [x,y] = e.get_coords();
        this._currentStroke.x2 = x; this._currentStroke.y2 = y;
        if (Math.abs(x-this._currentStroke.x1)>2||Math.abs(y-this._currentStroke.y1)>2)
            this._strokes.push(this._currentStroke);
        this._currentStroke = null; this._isDrawing = false;
        this._drawArea?.queue_repaint(); return Clutter.EVENT_STOP;
    }

    _startText(sx, sy) {
        this._textEntry = new St.Entry({
            style_class:'screenshot-ui-annotator-text-entry', x:sx, y:sy-32,
            hint_text:'Escribe y presiona Enter…',
        });
        this._textEntry._sx = sx; this._textEntry._sy = sy;
        this._ui.add_child(this._textEntry);
        this._textEntry.grab_key_focus();
        this._textEntry.connect('key-press-event', (_e,ev) => {
            const s = ev.get_key_symbol();
            if (s===Clutter.KEY_Return||s===Clutter.KEY_KP_Enter) { this._commitText(); return Clutter.EVENT_STOP; }
            if (s===Clutter.KEY_Escape) {
                this._textEntry.destroy(); this._textEntry = null;
                this._deactivateTool(); this._ui.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _commitText() {
        if (!this._textEntry) return;
        const t = this._textEntry.get_text().trim();
        if (t) {
            this._strokes.push({tool:'text',color:{...this._color},width:this._width,
                x1:this._textEntry._sx,y1:this._textEntry._sy,text:t});
            this._drawArea?.queue_repaint();
        }
        this._textEntry.destroy(); this._textEntry = null;
        this._deactivateTool();
    }

    _paint(ctx) {
        ctx.setOperator(Cairo.Operator.CLEAR); ctx.paint();
        ctx.setOperator(Cairo.Operator.OVER);
        for (const s of this._strokes) renderStroke(ctx, s);
        if (this._currentStroke) renderStroke(ctx, this._currentStroke);
    }

    // ── Post-proceso del archivo guardado ──────────────────────────────────

    async postProcessFile(file, strokes, geometry, scale) {
        if (!strokes.length || !file) return;
        const path = file.get_path();
        if (!path) return;

        const [gx, gy]   = geometry ?? [0, 0];
        const pixStrokes = strokes.filter(s => s.tool === 'pixelate');
        const vecStrokes = strokes.filter(s => s.tool !== 'pixelate');
        let blockSize = 16;
        try { blockSize = this._settings?.get_int('pixelate-block-size') ?? 16; } catch(_e){}

        // 1. Cargar PNG
        let pixbuf;
        try { pixbuf = GdkPixbuf.Pixbuf.new_from_file(path); }
        catch (e) { console.error('[annotator] load:', e); return; }
        const W = pixbuf.width, H = pixbuf.height;

        // 2. Pixelación en memoria
        for (const s of pixStrokes) {
            try {
                const rx=Math.min(s.x1,s.x2)*scale-gx, ry=Math.min(s.y1,s.y2)*scale-gy;
                const rw=Math.abs(s.x2-s.x1)*scale, rh=Math.abs(s.y2-s.y1)*scale;
                const ix=Math.max(0,Math.round(rx)), iy=Math.max(0,Math.round(ry));
                const iw=Math.min(Math.round(rw),W-ix), ih=Math.min(Math.round(rh),H-iy);
                if (iw<4||ih<4) continue;
                const B=blockSize;
                const sub=pixbuf.new_subpixbuf(ix,iy,iw,ih);
                const sm=sub.scale_simple(Math.max(1,Math.floor(iw/B)),Math.max(1,Math.floor(ih/B)),GdkPixbuf.InterpType.NEAREST);
                const pix=sm.scale_simple(iw,ih,GdkPixbuf.InterpType.NEAREST);
                pix.copy_area(0,0,iw,ih,pixbuf,ix,iy);
            } catch(e){ console.error('[annotator] pixelate:', e); }
        }

        // 3. Strokes vectoriales sobre el mismo pixbuf en memoria
        if (vecStrokes.length) {
            let done = false;
            try {
                const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, W, H);
                const ctx = new Cairo.Context(surface);
                ctx.setOperator(Cairo.Operator.CLEAR); ctx.paint();
                ctx.setOperator(Cairo.Operator.OVER);
                ctx.translate(-gx, -gy); ctx.scale(scale, scale);
                for (const s of vecStrokes) renderStroke(ctx, s);
                surface.flush();
                const tmp = `${path}.ann.tmp`;
                surface.writeToPng(tmp);
                const annoPb = GdkPixbuf.Pixbuf.new_from_file(tmp);
                GLib.unlink(tmp);
                if (!pixbuf.has_alpha) pixbuf = pixbuf.add_alpha(false, 0, 0, 0);
                annoPb.composite(pixbuf, 0, 0, W, H, 0, 0, 1.0, 1.0, GdkPixbuf.InterpType.BILINEAR, 255);
                done = true;
            } catch(e) { console.error('[annotator] composite:', e); }

            // Fallback: python3 + pycairo (guarda la pixelación primero)
            if (!done) {
                try { pixbuf.savev(path, 'png', [], []); } catch(_e){}
                try { await this._python3Composite(path, vecStrokes, gx, gy, scale); }
                catch(e) { console.error('[annotator] python3:', e); }
                try {
                    const [,data] = GLib.file_get_contents(path);
                    St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD,'image/png',new GLib.Bytes(data));
                } catch(_e){}
                return;
            }
        }

        // 4. Guardar pixbuf final (pixelación + vectores)
        try { pixbuf.savev(path, 'png', [], []); }
        catch (e) { console.error('[annotator] save:', e); return; }

        // 5. Actualizar portapapeles
        try {
            const [,data] = GLib.file_get_contents(path);
            St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD,'image/png',new GLib.Bytes(data));
        } catch(e) { console.error('[annotator] clipboard:', e); }
    }

    async _python3Composite(path, vecStrokes, gx, gy, scale) {
        const py = `
import sys,json,math
try:import cairo
except:sys.exit(1)
d=json.loads(sys.stdin.read())
sf=cairo.ImageSurface.create_from_png(d['path'])
ct=cairo.Context(sf)
ct.translate(-d['gx'],-d['gy'])
ct.scale(d['scale'],d['scale'])
for s in d['strokes']:
 c=s['color'];ct.set_source_rgba(c['r'],c['g'],c['b'],c['a'])
 t=s['tool'];x1,y1=s['x1'],s['y1'];x2,y2=s.get('x2',x1),s.get('y2',y1)
 if t=='highlight':ct.rectangle(min(x1,x2),min(y1,y2),abs(x2-x1),abs(y2-y1));ct.fill()
 elif t=='rect':ct.set_line_width(s['width']);ct.rectangle(min(x1,x2),min(y1,y2),abs(x2-x1),abs(y2-y1));ct.stroke()
 elif t=='circle':
  cx=(x1+x2)/2;cy=(y1+y2)/2;rx=abs(x2-x1)/2;ry=abs(y2-y1)/2
  if rx>0 and ry>0:ct.save();ct.translate(cx,cy);ct.scale(rx,ry);ct.arc(0,0,1,0,6.2832);ct.restore();ct.set_line_width(s['width']);ct.stroke()
 elif t=='arrow':
  dx=x2-x1;dy=y2-y1;ln=(dx*dx+dy*dy)**0.5
  if ln>=5:
   an=math.atan2(dy,dx);hl=max(14,s['width']*4);sp=0.5236
   ct.set_line_width(s['width']);ct.set_line_cap(cairo.LineCap.ROUND)
   ct.move_to(x1,y1);ct.line_to(x2,y2);ct.stroke()
   ct.move_to(x2,y2);ct.line_to(x2-hl*math.cos(an-sp),y2-hl*math.sin(an-sp))
   ct.move_to(x2,y2);ct.line_to(x2-hl*math.cos(an+sp),y2-hl*math.sin(an+sp));ct.stroke()
 elif t=='text':ct.set_font_size(max(14,s['width']*5));ct.move_to(x1,y1);ct.show_text(s.get('text',''))
sf.write_to_png(d['path'])
sys.exit(0)`;
        const inp = JSON.stringify({path,gx,gy,scale,strokes:vecStrokes.map(s=>({
            tool:s.tool,color:s.color,width:s.width,x1:s.x1,y1:s.y1,x2:s.x2??s.x1,y2:s.y2??s.y1,text:s.text??''
        }))});
        await new Promise((res,rej) => {
            try {
                const proc = Gio.Subprocess.new(['python3','-c',py],
                    Gio.SubprocessFlags.STDIN_PIPE|Gio.SubprocessFlags.STDOUT_SILENCE|Gio.SubprocessFlags.STDERR_SILENCE);
                proc.communicate_utf8_async(inp,null,(p,r)=>{
                    try { p.communicate_utf8_finish(r); p.get_exit_status()===0?res():rej(new Error(`exit ${p.get_exit_status()}`)); }
                    catch(e){rej(e);}
                });
            } catch(e){rej(e);}
        });
    }
}

function renderStroke(ctx, s) {
    const c = s.color;
    ctx.setSourceRGBA(c.r, c.g, c.b, c.a);
    switch (s.tool) {
    case 'highlight':
        ctx.rectangle(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.abs(s.x2-s.x1),Math.abs(s.y2-s.y1));
        ctx.fill(); break;
    case 'pixelate':
        ctx.setSourceRGBA(0.3,0.3,0.3,0.55);
        ctx.rectangle(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.abs(s.x2-s.x1),Math.abs(s.y2-s.y1));
        ctx.fill();
        ctx.setSourceRGBA(1,1,1,0.85); ctx.setLineWidth(1.5);
        ctx.rectangle(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.abs(s.x2-s.x1),Math.abs(s.y2-s.y1));
        ctx.stroke(); break;
    case 'rect':
        ctx.setLineWidth(s.width);
        ctx.rectangle(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.abs(s.x2-s.x1),Math.abs(s.y2-s.y1));
        ctx.stroke(); break;
    case 'circle': {
        const cx=(s.x1+s.x2)/2,cy=(s.y1+s.y2)/2,rx=Math.abs(s.x2-s.x1)/2,ry=Math.abs(s.y2-s.y1)/2;
        if(rx<1||ry<1)break;
        ctx.save();ctx.translate(cx,cy);ctx.scale(rx,ry);ctx.arc(0,0,1,0,2*Math.PI);ctx.restore();
        ctx.setLineWidth(s.width);ctx.stroke(); break;
    }
    case 'arrow': {
        const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.sqrt(dx*dx+dy*dy);
        if(len<5)break;
        const ang=Math.atan2(dy,dx),hL=Math.max(14,s.width*4),sp=Math.PI/6;
        ctx.setLineWidth(s.width);ctx.setLineCap(Cairo.LineCap.ROUND);
        ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
        ctx.moveTo(s.x2,s.y2);ctx.lineTo(s.x2-hL*Math.cos(ang-sp),s.y2-hL*Math.sin(ang-sp));
        ctx.moveTo(s.x2,s.y2);ctx.lineTo(s.x2-hL*Math.cos(ang+sp),s.y2-hL*Math.sin(ang+sp));
        ctx.stroke(); break;
    }
    case 'text':
        ctx.setFontSize(Math.max(14,s.width*5));
        ctx.moveTo(s.x1,s.y1);ctx.showText(s.text??''); break;
    }
}
