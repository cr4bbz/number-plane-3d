# number-plane-3d

Interactive browser visualization of the parametrized real algebra

\[
A_\kappa = \mathbb{R}[\varepsilon]/(\varepsilon^2-\kappa)
\]

and the norm surface

\[
\Sigma = \{(a,b,\kappa)\in\mathbb{R}^3 \mid a^2-\kappa b^2=1\}.
\]

The project is intentionally small: **Three.js + Vite, no UI framework**.

## What Gate 1 visualizes

- the full 3D norm surface `Σ`
- horizontal `κ = const.` slices
- reference slices at `κ = -1, 0, +1`
- a probe point `z = a + b ε` constrained to the surface
- the projection `π(a,b,κ) = a` onto the real axis
- the real eigen-directions that appear for `κ > 0`
- an animation that moves continuously through the elliptic → parabolic → hyperbolic regimes\n- analytically symmetric admissibility frontiers for κ < 0

The coordinate convention is:

- `x = a`
- `y = b`
- `z = κ`

## Local start

Requirements: a current Node.js installation with npm.

```powershell
git clone https://github.com/cr4bbz/number-plane-3d.git
cd number-plane-3d
npm install
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173/`.

## Production build

```powershell
npm run build
npm run preview
```

## Controls

- **mouse drag:** rotate camera
- **mouse wheel:** zoom
- **κ slider:** move the active horizontal slice
- **b slider:** move the probe point along the active slice
- **+a / −a:** switch between the two sheets of `Σ`
- **κ animieren:** sweep automatically through the three regimes
- layer switches: surface, slice, projection and eigen-directions

## Mathematics

The multiplication rule is

\[
(a+b\varepsilon)(c+d\varepsilon)
=(ac+\kappa bd)+(ad+bc)\varepsilon.
\]

Conjugation and norm are

\[
\overline{a+b\varepsilon}=a-b\varepsilon,
\qquad
N_\kappa(a+b\varepsilon)=a^2-\kappa b^2.
\]

The transition operator

\[
L_\varepsilon=
\begin{pmatrix}
0 & \kappa\\
1 & 0
\end{pmatrix}
\]

satisfies

\[
L_\varepsilon^2=\kappa I.
\]

Hence the sign of `κ` separates three regimes:

| κ | regime | real eigen-directions |
|---|---|---|
| `< 0` | elliptic | none |
| `= 0` | parabolic / nilpotent | exactly one: `a = 0` (the `b`-axis) |
| `> 0` | hyperbolic | two |

For `κ < 0`, the real domain ends symmetrically at\n\n\\[\n|b| = \\frac{1}{\\sqrt{-\\kappa}},\n\\]\n\nso the two admissibility frontiers are exact mirror images under `b -> -b`. The renderer parameterizes this boundary directly rather than clipping invalid mesh vertices.\n\nFor `κ > 0`, the eigen-directions have slopes

\[
b=\pm\frac{1}{\sqrt{\kappa}}a.
\]

## Planned gates

### Gate 2 · Projective flow
Visualize the flow `Φ_t(z)=e^{tε}z` and its projectivization directly on the 3D family.

### Gate 3 · Idempotent sheets
Visualize `e_±=(1±ε/√κ)/2`, their projectors and the birth of the two hyperbolic directions at `κ=0`.

### Gate 4 · Research export
Add reproducible screenshots / video export and a small data layer that can be compared against Lean-verified statements.

## License

MIT unless changed later.
