# 📸 Screenshot Annotator

Extensión para GNOME Shell 49 que agrega herramientas de anotación **directamente dentro del panel de captura de pantalla nativo** de GNOME. Sin ventanas separadas, sin apps externas — las herramientas aparecen integradas en la misma UI que se abre al presionar `PrintScreen`.

## ✨ Novedades en v2.0
<img width="1309" height="258" alt="Captura desde 2026-04-23 00-29-48" src="https://github.com/user-attachments/assets/3ddf4f88-05ff-4e78-9241-88861cd6fb17" />

### Nuevas herramientas de anotación
- **Línea recta** — arrastra para dibujar una línea perfectamente recta entre dos puntos
- **Trazo libre** — dibuja a mano alzada con total libertad sobre la captura
- **Contador numerado** — haz clic para colocar círculos numerados automáticamente (1, 2, 3...), ideal para documentar pasos o señalar elementos en orden

### Panel minimizable
- **Barra flotante** — el panel de captura completo se puede colapsar en una barra compacta y arrastrable que puedes mover a cualquier parte de la pantalla, dejando la imagen completamente visible mientras anotas
<img width="1015" height="173" alt="Captura desde 2026-04-23 00-30-45" src="https://github.com/user-attachments/assets/a66928be-a080-46e3-ad87-7e67bf189e8d" />

---

## ✨ Características

| Herramienta | Descripción |
| :---: | --- |
| <img width="28" height="28" alt="image" src="https://github.com/user-attachments/assets/f49ada36-a2e5-4c67-a5e3-b64619102495" /> | **Resaltado**: Resalta áreas específicas con un color semi-transparente. |
| <img width="28" height="28" alt="image" src="https://github.com/user-attachments/assets/fb40893e-1639-4524-a044-b7a0cd937990" /> | **Rectángulo**: Dibuja bordes rectangulares con grosor configurable. |
| <img width="28" height="28" alt="image" src="https://github.com/user-attachments/assets/8fd041ab-da50-4acf-b667-9f225e72c626" /> | **Elipse**: Dibuja elipses y círculos perfectos. |
| <img width="28" height="28" alt="image" src="https://github.com/user-attachments/assets/4b66e60d-3e7b-41d2-b9d3-d004d3eebc98" /> | **Flecha**: Dibuja flechas para señalar elementos importantes. |
| <img width="28" height="28" alt="image" src="https://github.com/user-attachments/assets/9bd34080-e911-4c7c-b020-5877df51937a" /> | **Texto**: Inserta anotaciones de texto en cualquier posición. |
| <span style="background-color:#6c757d; display:inline-block; padding:8px;"><img src="icons/pixelate-annotator-symbolic.svg" width="32"></span> | **Pixelado**: Censura regiones sensibles con un efecto mosaico. |

- 🎨 **6 colores** predefinidos y color hexadecimal (amarillo, rojo, azul, verde, blanco, negro)
- 📏 **3 grosores** de trazo (fino, medio, grueso)
- ↩️ **Deshacer** trazo a trazo
- 🗑️ **Limpiar** todas las anotaciones
- ✅ **Funciona con**: botón capturar `●`, `Enter` y `Ctrl+C`
- 🔒 **Se oculta automáticamente** en modo Ventana y Grabar
- ⚙️ **Configurable**: tamaño de pixelado y compresión PNG

---

## 📋 Requisitos

- GNOME Shell **49**
- Fedora 43 (probado) o cualquier distro con GNOME 49
---

## 📦 Instalación

### Opción 1 — Script automático

```bash
# Instalar:
cd screenshot-annotator
bash install.sh
```

### Debes reiniciar sesion para ver la extensión!

---
## 🚀 Uso

1. Presiona `PrintScreen` — aparece el panel de captura de GNOME con la barra de herramientas de anotación integrada debajo de los botones Selección / Pantalla / Ventana.

2. **Selecciona una herramienta** haciendo clic en su botón — el cursor cambia a modo dibujo.

3. **Dibuja** sobre el preview de la captura.

4. **Guarda** con cualquiera de estas opciones:
   - Botón `●` (capturar)
   - `Enter`
   - `Ctrl+C` (copia al portapapeles)

5. La imagen guardada y el portapapeles contendrán la imagen **con las anotaciones aplicadas**.

## ⚙️ Configuración

Abre **GNOME Extensions → Screenshot Annotator → Configuración**:

- **Compresión PNG** — nivel 0 (archivo grande, más rápido) a 9 (archivo pequeño, más lento). Por defecto: 6.
- **Tamaño de bloque del pixelado** — de 4 px (fino) a 64 px (muy grueso). Por defecto: 16 px.

---
