export const EPS = 1e-8;

export function phaseName(kappa) {
  if (kappa < -EPS) return 'elliptisch';
  if (kappa > EPS) return 'hyperbolisch';
  return 'parabolisch';
}
export function conicName(kappa) {
  if (Math.abs(kappa + 1) <= EPS) return 'Kreis';
  if (kappa < -EPS) return 'Ellipse';
  if (kappa > EPS) return 'Hyperbel';
  return 'Parabel';
}
export function normalizedKappa(kappa) { return kappa / (1 + Math.abs(kappa)); }
export function coneCoupling(kappa, mode = 'exact') {
  if (mode === 'normalized') {
    const coneKappa = normalizedKappa(kappa);
    const m = Math.sqrt(1 + coneKappa);
    return {available:true,mode,exact:false,sourceKappa:kappa,kappa:coneKappa,m,alpha:Math.atan(m),eccentricity:m,conic:conicName(coneKappa)};
  }
  if (kappa < -1 - EPS) return {available:false,mode,exact:true,sourceKappa:kappa,kappa:null,m:null,alpha:null,eccentricity:null,conic:null};
  const clamped = Math.max(-1,kappa);
  const m = Math.sqrt(1+clamped);
  return {available:true,mode,exact:true,sourceKappa:kappa,kappa:clamped,m,alpha:Math.atan(m),eccentricity:m,conic:conicName(clamped)};
}
export function admissibleBLimit(kappa, configuredMax=3) {
  if (kappa >= 0) return configuredMax;
  return Math.min(configuredMax,1/Math.sqrt(-kappa));
}
export function normPoint(kappa,b,branchSign=1) {
  const radicand=1+kappa*b*b;
  if (radicand < -EPS) return null;
  return {a:branchSign*Math.sqrt(Math.max(0,radicand)),b,kappa};
}
export function normValue(a,b,kappa){return a*a-kappa*b*b;}
export function coneIntersectionRadicand(y,coupling,h=1){
  if(!coupling.available)return Number.NaN;
  return coupling.kappa*y*y+2*coupling.m*h*y+h*h;
}
export function coneIntersectionPoint(y,branchSign,coupling,h=1){
  const radicand=coneIntersectionRadicand(y,coupling,h);
  if(!Number.isFinite(radicand)||radicand < -EPS)return null;
  return {x:branchSign*Math.sqrt(Math.max(0,radicand)),y,z:coupling.m*y+h};
}
export function nullSliceKind(kappa){
  if(kappa < -EPS)return 'origin';
  if(kappa > EPS)return 'two-lines';
  return 'one-line';
}
