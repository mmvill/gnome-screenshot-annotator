/**
 * prefs.js — v11
 * Solo calidad de imagen y tamaño de pixelado.
 */
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ScreenshotAnnotatorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const s = this.getSettings('org.gnome.shell.extensions.screenshot-annotator');
        window.set_default_size(520, 380);

        const page = new Adw.PreferencesPage({
            title: 'Screenshot Annotator',
            icon_name: 'marker-symbolic',
        });
        window.add(page);

        // ── Calidad de imagen ──────────────────────────────────────────────
        const grpQuality = new Adw.PreferencesGroup({
            title: 'Calidad de imagen',
            description: 'Ajustes del PNG generado al guardar',
        });
        page.add(grpQuality);

        const rowPng = new Adw.SpinRow({
            title:   'Compresión PNG',
            subtitle: '0 = sin comprimir (archivo más grande)  ·  9 = máxima compresión (archivo más pequeño)',
            adjustment: new Gtk.Adjustment({lower:0, upper:9, step_increment:1, value:s.get_int('png-compression')}),
        });
        s.bind('png-compression', rowPng, 'value', Gio.SettingsBindFlags.DEFAULT);
        grpQuality.add(rowPng);

        // ── Pixelado ───────────────────────────────────────────────────────
        const grpPix = new Adw.PreferencesGroup({
            title: 'Tamaño del pixelado',
            description: 'Controla el grosor de los "cuadritos" del efecto mosaico',
        });
        page.add(grpPix);

        const rowBlock = new Adw.SpinRow({
            title:   'Tamaño de bloque',
            subtitle: '4 px = pixelado fino  ·  64 px = pixelado muy grueso',
            adjustment: new Gtk.Adjustment({lower:4, upper:64, step_increment:2, value:s.get_int('pixelate-block-size')}),
        });
        s.bind('pixelate-block-size', rowBlock, 'value', Gio.SettingsBindFlags.DEFAULT);
        grpPix.add(rowBlock);
    }
}
