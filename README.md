# Sinjar — Guardian of the Mountain

A cinematic 3D browser action prototype set in a fictionalized Sinjar mountain environment.

## Features
- Three.js / WebGL 3D scene
- First-person combat
- Enemy AI, health, armor, ammunition and reload system
- Procedural Sinjar-inspired terrain, village ruins, smoke and volumetric atmosphere
- Stylized Yazidi sun-inspired environmental landmark
- Desktop controls + Android/iOS touch controls
- Quality presets for stronger phones and slower devices
- Static hosting: GitHub Pages, Vercel or Netlify

## Run locally
Because the project uses ES modules, serve it through a local HTTP server:

```bash
npx serve .
```

Then open the shown local URL.

## GitHub Pages
Repository **Settings → Pages → Deploy from a branch → main / root**.

## Controls
- WASD: move
- Mouse: look
- Left click: fire
- R: reload
- Shift: sprint
- Space: jump

## Visual realism roadmap
This prototype deliberately avoids low-poly/cartoon styling, but true photorealism requires production-quality PBR assets. The next upgrade should replace procedural characters/buildings with optimized GLB assets using 2K PBR textures, skeletal animation, LODs and compressed KTX2 textures.

## Content note
This is fictionalized interactive media. It depicts ISIS only as an opposing terrorist force and does not include propaganda media or operational instruction.
