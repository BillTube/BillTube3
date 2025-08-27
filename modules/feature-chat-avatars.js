// modules/feature-chat-avatars.js
BTFW.define("feature:chatAvatars", ["feature:chat"], async ({ require }) => {
  // Unicode-safe slice used in BillTube2 for initials (ported) :contentReference[oaicite:5]{index=5}
  function unicodeCharAt(str, index) {
    const first = str.charCodeAt(index);
    if (first >= 0xD800 && first <= 0xDBFF && str.length > index + 1) {
      const second = str.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) {
        return str.substring(index, index + 2);
      }
    }
    return str[index];
  }
  function unicodeSlice(str, start, end) {
    let out = "", si = 0, ui = 0;
    while (si < str.length) {
      const ch = unicodeCharAt(str, si);
      if (ui >= start && ui < end) out += ch;
      si += ch.length; ui++;
    }
    return out;
  }

  function svgAvatar(name, size = 28) {
    const seed = 7;
    const colors = ["#1abc9c","#16a085","#f1c40f","#f39c12","#2ecc71","#27ae60","#e67e22","#d35400","#3498db","#2980b9","#e74c3c","#c0392b","#9b59b6","#8e44ad","#0080a5","#34495e","#2c3e50","#87724b","#7300a7","#ec87bf","#d870ad","#f69785","#9ba37e","#b49255","#a94136"];
    const letters = unicodeSlice(name || "?", 0, 2).toUpperCase();
    const ci = (letters.codePointAt(0) + seed) % colors.length;
    const bg = colors[ci];
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" rx="6" ry="6" fill="${bg}"/>
        <text x="50%" y="50%" dy=".35em" text-anchor="middle"
          fill="#fff" font-family="Inter,system-ui,Arial" font-weight="600" font-size="${Math.floor(size*0.5)}">${letters}</text>
      </svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  function getProfileFromUserlist(username) {
    const item = Array.from(document.querySelectorAll("#userlist .userlist_item")).find(li => li.dataset.name === username || li.textContent.trim() === username);
    const profile = (item && (item.dataset.profile && JSON.parse(item.dataset.profile))) || null;
    return profile && profile.image || null;
  }

  function injectAvatar(node) {
    if (!node || node._btfw_avatar) return;
    const nameEl = node.querySelector(".username");
    if (!nameEl) return;
    const username = nameEl.textContent.replace(":", "").trim();

    // Skip if already has an avatar
    if (node.querySelector(".btfw-chat-avatar")) return;

    const img = document.createElement("img");
    img.className = "btfw-chat-avatar";
    img.width = 28; img.height = 28;

    const explicit = getProfileFromUserlist(username);
    img.src = explicit || svgAvatar(username, 28); // fallback exactly like BillTube2’s initials approach :contentReference[oaicite:6]{index=6}

    // Place avatar before username
    nameEl.parentElement?.insertBefore(img, nameEl);
    node._btfw_avatar = true;
  }

  function observe() {
    const buf = document.getElementById("messagebuffer");
    if (!buf || buf._btfw_avatar_observed) return;
    buf._btfw_avatar_observed = true;
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(injectAvatar))).observe(buf, { childList: true });
    Array.from(buf.children).forEach(injectAvatar);
  }

  document.addEventListener("btfw:layoutReady", observe);
  setTimeout(observe, 1500);

  return { name: "feature:chatAvatars" };
});
