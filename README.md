# number-plane-3d

Interactive research viewer for the parametrized real algebra

\[
A_\kappa=\mathbb{R}[\varepsilon]/(\varepsilon^2-\kappa)
\]

and its norm family

\[
\Sigma=\{(a,b,\kappa)\in\mathbb{R}^3\mid a^2-\kappa b^2=1\}.
\]

## Gate 2A · Synced Compare Mode

The screen is split into two independently rotatable 3D views: the number-plane family on the left and a double-cone cut on the right.

The exact coupling is

\[
\kappa=m^2-1=\tan^2\alpha-1.
\]

Thus negative/zero/positive κ matches ellipse/parabola/hyperbola, with κ=-1 giving the circular cut.

The exact standard-cone identification is real only for κ≥-1. For κ<-1 the viewer says so explicitly. A second normalized mode uses

\[
\widehat\kappa=\frac{\kappa}{1+|\kappa|}
\]

to preserve the sign/type across all real source κ without pretending that magnitudes are identical.

## Gate 2B · Research Mode

The optional null-set layer visualizes

\[
N_\kappa(a+b\varepsilon)=a^2-\kappa b^2=0.
\]

This exposes the transition from only the trivial zero (κ<0), through one critical null direction (κ=0), to two real null directions (κ>0). For κ>0 those null directions coincide with the real eigendirections of multiplication by ε.

The shared research strip reports phase, norm value, null structure, plane slope m, plane angle α, eccentricity e, and the active exact/normalized mapping.

## Local start

Requires Node.js 22+ and npm.

```powershell
git clone https://github.com/cr4bbz/number-plane-3d.git
cd number-plane-3d
npm install
npm test
npm run dev
```

Vite binds to all local interfaces and usually prints both localhost and LAN addresses.

Production:

```powershell
npm run build
npm run preview
```

## Controls

- rotate and zoom each 3D view independently
- source κ ranges ±2, ±10, ±50, ±100
- shared κ and b controls
- exact / normalized cone coupling
- optional norm surface, slice, projection, eigendirections and null set
- optional cone, cutting plane, conic intersection and coupled probe
- κ animation across the phase transition

## Automated checks

`npm test` checks the pure algebra/cone mapping. GitHub Actions runs tests and a Vite production build on pushes and pull requests.

## License

MIT.
