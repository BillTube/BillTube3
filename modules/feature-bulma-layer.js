
BTFW.define("feature:bulma", ["feature:styleCore"], async ({}) => {
  if (!document.querySelector('style[data-btfw-bulma-layer]')){
    const s=document.createElement("style"); s.dataset.btfwBulmaLayer="1"; s.textContent='@layer btfw-bulma{@import url("https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css");}'; document.head.appendChild(s);
  }
  return { name:"feature:bulma" };
});
