#!/bin/bash
# install.sh — Screenshot Annotator v1.0
# Uso: bash install.sh

set -e

UUID="screenshot-annotator@moises"
EXT="$HOME/.local/share/gnome-shell/extensions/$UUID"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📸 Instalando Screenshot Annotator v1.0..."
rm -rf "$EXT"
mkdir -p "$EXT/schemas" "$EXT/icons"

cp "$DIR"/*.js  "$EXT/"
cp "$DIR"/*.css "$EXT/"
cp "$DIR"/*.json "$EXT/"
cp "$DIR"/schemas/*.xml "$EXT/schemas/"
glib-compile-schemas "$EXT/schemas/"
cp "$DIR"/icons/*.svg "$EXT/icons/"

echo "✅ Archivos instalados"

gnome-extensions disable "$UUID" 2>/dev/null || true
gnome-extensions enable  "$UUID" 2>/dev/null \
    && echo "✅ Extensión activada" \
    || echo "⚠️  Actívala desde: Configuración → Extensiones"

echo ""
echo "🎉 Listo. Presiona PrintScreen para usar las herramientas."
