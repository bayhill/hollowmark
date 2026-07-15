class A { x = 1; y = 1; }
function one(list: A[]) {
  let target: A | null = null;
  list.forEach((p) => { target = p; });
  if (!target) return;
  const t: A = target;
  return t.x;
}
class B { x = 2; y = 2; }
function two(list: A[], mercs: B[]) {
  let target: A | B | null = null;
  list.forEach((p) => { target = p; });
  mercs.forEach((mc) => { target = mc; });
  if (!target) return;
  const t: A | B = target;
  return t.x;
}
one([]); two([], []);
