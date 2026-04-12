/**
 * extension.js — v11
 */
import {Extension}     from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Screenshot  from 'resource:///org/gnome/shell/ui/screenshot.js';
import * as Main        from 'resource:///org/gnome/shell/ui/main.js';
import {AnnotatorPanel} from './annotatorPanel.js';
import GLib             from 'gi://GLib';

const SYM = Symbol('screenshotAnnotator');
let _origOpen = null, _origSave = null;

async function patchedSave() {
    const panel   = this[SYM] instanceof AnnotatorPanel ? this[SYM] : null;
    const strokes = panel?.getStrokes() ?? [];

    if (!strokes.length || this._windowButton?.checked)
        return _origSave.call(this);

    let geometry = null;
    const scale  = this._scale ?? 1;
    try {
        if (this._selectionButton?.checked || this._screenButton?.checked)
            geometry = this._getSelectedGeometry(true);
    } catch (_e) {}

    let savedFile = null;
    const cid = this.connect('screenshot-taken', (_ui, f) => { savedFile = f; });
    await _origSave.call(this);
    this.disconnect(cid);

    if (savedFile && panel) {
        try { await panel.postProcessFile(savedFile, strokes, geometry, scale); }
        catch (e) { console.error('[annotator] postProcess:', e); }
    }
}

export default class ScreenshotAnnotatorExtension extends Extension {
    enable() {
        const self = this;
        _origOpen = Screenshot.ScreenshotUI.prototype.open;
        Screenshot.ScreenshotUI.prototype.open = async function (mode) {
            await _origOpen.call(this, mode);
            if (!this[SYM]) {
                this[SYM] = 'pending';
                await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 280,
                    () => { r(); return GLib.SOURCE_REMOVE; }));
                try {
                    const settings = self.getSettings(
                        'org.gnome.shell.extensions.screenshot-annotator');
                    const panel = new AnnotatorPanel(this, settings, self.path);
                    panel.inject();
                    this[SYM] = panel;
                } catch (e) { console.error('[annotator] inject:', e); this[SYM] = null; }
            }
            if (this[SYM] instanceof AnnotatorPanel) this[SYM].reset();
        };
        _origSave = Screenshot.ScreenshotUI.prototype._saveScreenshot;
        Screenshot.ScreenshotUI.prototype._saveScreenshot = patchedSave;
    }

    disable() {
        if (_origOpen) { Screenshot.ScreenshotUI.prototype.open = _origOpen; _origOpen = null; }
        if (_origSave)  { Screenshot.ScreenshotUI.prototype._saveScreenshot = _origSave; _origSave = null; }
        try {
            const g = Main.layoutManager.screenshotUIGroup;
            if (g) for (const c of g.get_children()) {
                if (c[SYM] instanceof AnnotatorPanel) c[SYM].destroy();
                try { delete c[SYM]; } catch (_e) {}
            }
        } catch (_e) {}
    }
}
