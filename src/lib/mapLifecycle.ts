// Testable public lifecycle owner. React's effect replay always releases before reacquiring.
export function ownMap<T extends { remove: () => void }>(create: () => T, ready: (map:T) => void) {
  const map=create();
  try { ready(map); } catch(error) { map.remove(); throw error; }
  let removed=false;
  return () => { if (!removed) { removed=true; map.remove(); } };
}
