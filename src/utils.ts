/** Hide all .view elements and show the one with the given id. */
export function show(id: string): void {
  document.querySelectorAll<HTMLElement>('.view').forEach(el => {
    el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = '';
}
