BTFW.define("feature:channelThemeAdmin", [], async () => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rangeSliders = await BTFW.init("util:rangeSliders");

  const JS_BLOCK_START  = "// ==BTFW_THEME_ADMIN_START==";
  const JS_BLOCK_END    = "// ==BTFW_THEME_ADMIN_END==";
  const CSS_BLOCK_START = "/* ==BTFW_THEME_ADMIN_START== */";
  const CSS_BLOCK_END   = "/* ==BTFW_THEME_ADMIN_END== */";

  const JS_FIELD_SELECTORS = [
    "#cs-jstext",
    "#chanjs", "#channel-js", "#channeljs", "#customjs", "#customJS",
    "textarea[name=chanjs]", "textarea[name=channeljs]",
    "textarea[data-setting='customJS']", "textarea[data-setting='chanjs']",
    "textarea[name='js']", ".channel-js-field"
  ];

  const CSS_FIELD_SELECTORS = [
    "#cs-csstext",
    "#chancss", "#channel-css", "#channelcss", "#customcss", "#customCSS",
    "textarea[name=chancss]", "textarea[name=channelcss]",
    "textarea[data-setting='customCSS']", "textarea[data-setting='chancss']",
    "textarea[name='css']", ".channel-css-field"
  ];

  /* Hero Patterns (heropatterns.com, CC BY 4.0 by Steve Schoger) — compact
     tiling SVGs, stored with marker values that patternImageValue() swaps for
     the channel's real colors: a1b2c3 = fill hex, 0.987 = fill-opacity. The
     chosen pattern is baked into the generated Channel CSS, so viewers need
     no extra code. Placeholder is filled by the build step below. */
  const BG_PATTERNS = {
    hexagons: { label: "Hexagons", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2249%22%20viewBox%3D%220%200%2028%2049%22%3E%3Cpath%20d%3D%22M13.99%209.25l13%207.5v15l-13%207.5L1%2031.75v-15l12.99-7.5zM3%2017.9v12.7l10.99%206.34%2011-6.35V17.9l-11-6.34L3%2017.9zM0%2015l12.98-7.5V0h-2v6.35L0%2012.69v2.3zm0%2018.5L12.98%2041v8h-2v-6.85L0%2035.81v-2.3zM15%200v7.5L27.99%2015H28v-2.31h-.01L17%206.35V0h-2zm0%2049v-8l12.99-7.5H28v2.31h-.01L17%2042.15V49h-2z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22nonzero%22%2F%3E%3C%2Fsvg%3E')" },
    plus: { label: "Plus", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    squares: { label: "Squares", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Cpath%20d%3D%22M6%2018h12V6H6v12zM4%204h16v16H4V4z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22nonzero%22%2F%3E%3C%2Fsvg%3E')" },
    boxes: { label: "Boxes", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ebozes%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%200h20L0%2020z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    diagonalLines: { label: "Diagonal Lines", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%226%22%20height%3D%226%22%20viewBox%3D%220%200%206%206%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EArtboard%203%20Copy%202%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M5%200h1L0%206V5zM6%205v1H5z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    diagonalStripes: { label: "Diagonal Stripes", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ediagonal-stripes%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020zM40%2040V20L20%2040z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    zigZag: { label: "Zig Zag", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2212%22%20viewBox%3D%220%200%2040%2012%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ezig-zag%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%206.172L6.172%200h5.656L0%2011.828V6.172zm40%205.656L28.172%200h5.656L40%206.172v5.656zM6.172%2012l12-12h3.656l12%2012h-5.656L20%203.828%2011.828%2012H6.172zm12%200L20%2010.172%2021.828%2012h-3.656z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    houndstooth: { label: "Houndstooth", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ehoundstooth%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2018h6l6-6v6h6l-6%206H0zM24%2018v6h-6zM24%200l-6%206h-6l6-6zM12%200v6L0%2018v-6l6-6H0V0z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    brickWall: { label: "Brick Wall", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2242%22%20height%3D%2244%22%20viewBox%3D%220%200%2042%2044%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200h42v44H0V0zm1%201h40v20H1V1zM0%2023h20v20H0V23zm22%200h20v20H22V23z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    tinyCheckers: { label: "Checkers", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%228%22%20width%3D%228%22%20viewBox%3D%220%200%208%208%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20d%3D%22M0%200h4v4H0V0zm4%204h4v4H4V4z%22%2F%3E%3C%2Fsvg%3E')" },
    flippedDiamonds: { label: "Diamonds", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2216%22%20height%3D%2220%22%20viewBox%3D%220%200%2016%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Eflipped-diamonds%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M8%200v20L0%2010zM16%200v10L8%200zM16%2010v10H8z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    overlappingDiamonds: { label: "Overlap Diamonds", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2248%22%20height%3D%2264%22%20viewBox%3D%220%200%2048%2064%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Eoverlapping-diamonds%3C%2Ftitle%3E%3Cpath%20d%3D%22M48%2028v-4L36%2012%2024%2024%2012%2012%200%2024v4l4%204-4%204v4l12%2012%2012-12%2012%2012%2012-12v-4l-4-4%204-4zM8%2032l-6-6%2010-10%2010%2010-6%206%206%206-10%2010L2%2038l6-6zm12%200l4-4%204%204-4%204-4-4zm12%200l-6-6%2010-10%2010%2010-6%206%206%206-10%2010-10-10%206-6zM0%2016L10%206%204%200h4l4%204%204-4h4l-6%206%2010%2010L34%206l-6-6h4l4%204%204-4h4l-6%206%2010%2010v4L36%208%2024%2020%2012%208%200%2020v-4zm0%2032l10%2010-6%206h4l4-4%204%204h4l-6-6%2010-10%2010%2010-6%206h4l4-4%204%204h4l-6-6%2010-10v-4L36%2056%2024%2044%2012%2056%200%2044v4z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    fourPointStars: { label: "Stars", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%2224%22%20width%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20d%3D%22M8%204l4%202-4%202-2%204-2-4-4-2%204-2%202-4%202%204z%22%2F%3E%3C%2Fsvg%3E')" },
    slantedStars: { label: "Slanted Stars", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2230%22%20height%3D%2230%22%20viewBox%3D%220%200%2030%2030%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Etriangles%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%2015l15%2015H0V15zM15%200l15%2015V0H15z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    ticTacToe: { label: "Tic Tac Toe", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2064%2064%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Etic-tac-toe%3C%2Ftitle%3E%3Cpath%20d%3D%22M8%2016c4.418%200%208-3.582%208-8s-3.582-8-8-8-8%203.582-8%208%203.582%208%208%208zm0-2c3.314%200%206-2.686%206-6s-2.686-6-6-6-6%202.686-6%206%202.686%206%206%206zm33.414-6l5.95-5.95L45.95.636%2040%206.586%2034.05.636%2032.636%202.05%2038.586%208l-5.95%205.95%201.414%201.414L40%209.414l5.95%205.95%201.414-1.414L41.414%208zM40%2048c4.418%200%208-3.582%208-8s-3.582-8-8-8-8%203.582-8%208%203.582%208%208%208zm0-2c3.314%200%206-2.686%206-6s-2.686-6-6-6-6%202.686-6%206%202.686%206%206%206zM9.414%2040l5.95-5.95-1.414-1.414L8%2038.586l-5.95-5.95L.636%2034.05%206.586%2040l-5.95%205.95%201.414%201.414L8%2041.414l5.95%205.95%201.414-1.414L9.414%2040z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    graphPaper: { label: "Graph Paper", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20opacity%3D%22.5%22%20d%3D%22M96%2095h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-9-10h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm9-10v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-9-10h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm9-10v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-9-10h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm9-10v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-10%200v-9h-9v9h9zm-9-10h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9zm10%200h9v-9h-9v9z%22%2F%3E%3Cpath%20d%3D%22M6%205V0H5v5H0v1h5v94h1V6h94V5H6z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    pixelDots: { label: "Pixel Dots", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Epixel-dots%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%200h16v2h-6v6h6v8H8v-6H2v6H0V0zm4%204h2v2H4V4zm8%208h2v2h-2v-2zm-8%200h2v2H4v-2zm8-8h2v2h-2V4z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    polkaDots: { label: "Polka Dots", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Edots%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Ccircle%20cx%3D%223%22%20cy%3D%223%22%20r%3D%223%22%2F%3E%3Ccircle%20cx%3D%2213%22%20cy%3D%2213%22%20r%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    bubbles: { label: "Bubbles", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ebubbles%3C%2Ftitle%3E%3Cpath%20d%3D%22M11%2018c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm48%2025c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm-43-7c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zm63%2031c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zM34%2090c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zm56-76c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zM12%2086c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm28-65c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm23-11c2.761%200%205-2.239%205-5s-2.239-5-5-5-5%202.239-5%205%202.239%205%205%205zm-6%2060c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm29%2022c2.761%200%205-2.239%205-5s-2.239-5-5-5-5%202.239-5%205%202.239%205%205%205zM32%2063c2.761%200%205-2.239%205-5s-2.239-5-5-5-5%202.239-5%205%202.239%205%205%205zm57-13c2.761%200%205-2.239%205-5s-2.239-5-5-5-5%202.239-5%205%202.239%205%205%205zm-9-21c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM60%2091c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM35%2041c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM12%2060c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    overlappingCircles: { label: "Circles", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M50%2050c0-5.523%204.477-10%2010-10s10%204.477%2010%2010-4.477%2010-10%2010c0%205.523-4.477%2010-10%2010s-10-4.477-10-10%204.477-10%2010-10zM10%2010c0-5.523%204.477-10%2010-10s10%204.477%2010%2010-4.477%2010-10%2010c0%205.523-4.477%2010-10%2010S0%2025.523%200%2020s4.477-10%2010-10zm10%208c4.418%200%208-3.582%208-8s-3.582-8-8-8-8%203.582-8%208%203.582%208%208%208zm40%2040c4.418%200%208-3.582%208-8s-3.582-8-8-8-8%203.582-8%208%203.582%208%208%208z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    circlesAndSquares: { label: "Circles + Squares", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ecircle-squares%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%200h20v20H0V0zm10%2017c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm20%200c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zM10%2037c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm10-17h20v20H20V20zm10%2017c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    wiggle: { label: "Wiggle", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2252%22%20height%3D%2226%22%20viewBox%3D%220%200%2052%2026%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M10%2010c0-2.21-1.79-4-4-4-3.314%200-6-2.686-6-6h2c0%202.21%201.79%204%204%204%203.314%200%206%202.686%206%206%200%202.21%201.79%204%204%204%203.314%200%206%202.686%206%206%200%202.21%201.79%204%204%204v2c-3.314%200-6-2.686-6-6%200-2.21-1.79-4-4-4-3.314%200-6-2.686-6-6zm25.464-1.95l8.486%208.486-1.414%201.414-8.486-8.486%201.414-1.414z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    rain: { label: "Rain", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2216%22%20viewBox%3D%220%200%2012%2016%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Erain%3C%2Ftitle%3E%3Cpath%20d%3D%22M4%20.99C4%20.445%204.444%200%205%200c.552%200%201%20.451%201%20.99v4.02C6%205.555%205.556%206%205%206c-.552%200-1-.451-1-.99V.99zm6%208c0-.546.444-.99%201-.99.552%200%201%20.451%201%20.99v4.02c0%20.546-.444.99-1%20.99-.552%200-1-.451-1-.99V8.99z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    heavyRain: { label: "Heavy Rain", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2224%22%20viewBox%3D%220%200%2012%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M2%200h2v12H2V0zm1%2020c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM9%208c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zm-1%204h2v12H8V12z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    current: { label: "Current", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2276%22%20height%3D%2218%22%20viewBox%3D%220%200%2076%2018%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Ecurrent%3C%2Ftitle%3E%3Cpath%20d%3D%22M31.999%2018C29.571%2016.176%2028%2013.271%2028%2010c0-4.418-3.582-8-8-8H0V0h20c5.523%200%2010%204.477%2010%2010%200%204.418%203.582%208%208%208h20c4.418%200%208-3.582%208-8%200-5.523%204.477-10%2010-10v2c-4.418%200-8%203.582-8%208%200%203.271-1.57%206.176-3.999%208H31.999zM64.001%200C62.329%201.256%2060.251%202%2058%202H38c-2.252%200-4.33-.744-6.001-2h32.002z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    wallpaper: { label: "Wallpaper", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2284%22%20height%3D%2216%22%20viewBox%3D%220%200%2084%2016%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Eplus-lines%3C%2Ftitle%3E%3Cpath%20d%3D%22M78%207V4h-2v3h-3v2h3v3h2V9h3V7h-3zM30%207V4h-2v3h-3v2h3v3h2V9h3V7h-3zM10%200h2v16h-2V0zm6%200h4v16h-4V0zM2%200h4v16H2V0zm50%200h2v16h-2V0zM38%200h2v16h-2V0zm28%200h2v16h-2V0zm-8%200h6v16h-6V0zM42%200h6v16h-6V0z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    bamboo: { label: "Bamboo", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%2232%22%20width%3D%2216%22%20viewBox%3D%220%200%2016%2032%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20d%3D%22M0%2024h4v2H0v-2zm0%204h6v2H0v-2zm0-8h2v2H0v-2zM0%200h4v2H0V0zm0%204h2v2H0V4zm16%2020h-6v2h6v-2zm0%204H8v2h8v-2zm0-8h-4v2h4v-2zm0-20h-6v2h6V0zm0%204h-4v2h4V4zm-2%2012h2v2h-2v-2zm0-8h2v2h-2V8zM2%208h10v2H2V8zm0%208h10v2H2v-2zm-2-4h14v2H0v-2zm4-8h6v2H4V4zm0%2016h6v2H4v-2zM6%200h2v2H6V0zm0%2024h2v2H6v-2z%22%2F%3E%3C%2Fsvg%3E')" },
    leaf: { label: "Leaf", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2240%22%20viewBox%3D%220%200%2080%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Eleaf%3C%2Ftitle%3E%3Cg%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M2.011%2039.976c.018-4.594%201.785-9.182%205.301-12.687.475-.474.97-.916%201.483-1.326v9.771L4.54%2039.976H2.01zm5.373%200L23.842%2023.57c.687%205.351-1.031%2010.95-5.154%2015.06-.483.483-.987.931-1.508%201.347H7.384zm-7.384%200c.018-5.107%201.982-10.208%205.89-14.104%205.263-5.247%2012.718-6.978%2019.428-5.192%201.783%206.658.07%2014.053-5.137%2019.296H.001zm10.806-15.41c3.537-2.116%207.644-2.921%2011.614-2.415L10.806%2033.73v-9.163zM65.25.75C58.578-1.032%2051.164.694%2045.93%205.929c-5.235%205.235-6.961%2012.649-5.18%2019.321%206.673%201.782%2014.087.056%2019.322-5.179%205.235-5.235%206.961-12.649%205.18-19.321zM43.632%2023.783c5.338.683%2010.925-1.026%2015.025-5.126%204.1-4.1%205.809-9.687%205.126-15.025l-20.151%2020.15zm7.186-19.156c3.518-2.112%207.602-2.915%2011.55-2.41l-11.55%2011.55v-9.14zm-3.475%202.716c-4.1%204.1-5.809%209.687-5.126%2015.025l6.601-6.6V6.02c-.51.41-1.002.85-1.475%201.323zM.071%200C.065%201.766.291%203.533.75%205.25%207.422%207.032%2014.836%205.306%2020.07.071l.07-.071H.072zm17.086%200C13.25%203.125%208.345%204.386%203.632%203.783L7.414%200h9.743zM2.07%200c-.003.791.046%201.582.146%202.368L4.586%200H2.07z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')" },
    autumn: { label: "Autumn", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2288%22%20height%3D%2224%22%20viewBox%3D%220%200%2088%2024%22%3E%3Cpath%20d%3D%22M10%200l30%2015%202%201V2.18A10%2010%200%200%200%2041.76%200H39.7a8%208%200%200%201%20.3%202.18v10.58L14.47%200H10zm31.76%2024a10%2010%200%200%200-5.29-6.76L4%201%202%200v13.82a10%2010%200%200%200%205.53%208.94L10%2024h4.47l-6.05-3.02A8%208%200%200%201%204%2013.82V3.24l31.58%2015.78A8%208%200%200%201%2039.7%2024h2.06zM78%2024l2.47-1.24A10%2010%200%200%200%2086%2013.82V0l-2%201-32.47%2016.24A10%2010%200%200%200%2046.24%2024h2.06a8%208%200%200%201%204.12-4.98L84%203.24v10.58a8%208%200%200%201-4.42%207.16L73.53%2024H78zm0-24L48%2015l-2%201V2.18A10%2010%200%200%201%2046.24%200h2.06a8%208%200%200%200-.3%202.18v10.58L73.53%200H78z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    temple: { label: "Temple", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22152%22%20height%3D%22152%22%20viewBox%3D%220%200%20152%20152%22%3E%3Cpath%20d%3D%22M152%20150v2H0v-2h28v-8H8v-20H0v-2h8V80h42v20h20v42H30v8h90v-8H80v-42h20V80h42v40h8V30h-8v40h-42V50H80V8h40V0h2v8h20v20h8V0h2v150zm-2%200v-28h-8v20h-20v8h28zM82%2030v18h18V30H82zm20%2018h20v20h18V30h-20V10H82v18h20v20zm0%202v18h18V50h-18zm20-22h18V10h-18v18zm-54%2092v-18H50v18h18zm-20-18H28V82H10v38h20v20h38v-18H48v-20zm0-2V82H30v18h18zm-20%2022H10v18h18v-18zm54%200v18h38v-20h20V82h-18v20h-20v20H82zm18-20H82v18h18v-18zm2-2h18V82h-18v18zm20%2040v-18h18v18h-18zM30%200h-2v8H8v20H0v2h8v40h42V50h20V8H30V0zm20%2048h18V30H50v18zm18-20H48v20H28v20H10V30h20V10h38v18zM30%2050h18v18H30V50zm-2-40H10v18h18V10z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    moroccan: { label: "Moroccan", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2288%22%20viewBox%3D%220%200%2080%2088%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Emoroccan%3C%2Ftitle%3E%3Cpath%20d%3D%22M22%2021.91V26h-2.001C10.06%2026%202%2034.059%202%2044c0%209.943%208.058%2018%2017.999%2018H22v4.09c8.012.722%2014.785%205.738%2018%2012.73%203.212-6.991%209.983-12.008%2018-12.73V62h2.001C69.94%2062%2078%2053.941%2078%2044c0-9.943-8.058-18-17.999-18H58v-4.09c-8.012-.722-14.785-5.738-18-12.73-3.212%206.991-9.983%2012.008-18%2012.73zM54%2058v4.696c-5.574%201.316-10.455%204.428-14%208.69-3.545-4.262-8.426-7.374-14-8.69V58h-5.993C12.271%2058%206%2051.734%206%2044c0-7.732%206.275-14%2014.007-14H26v-4.696c5.574-1.316%2010.455-4.428%2014-8.69%203.545%204.262%208.426%207.374%2014%208.69V30h5.993C67.729%2030%2074%2036.266%2074%2044c0%207.732-6.275%2014-14.007%2014H54zM42%2088c0-9.941%208.061-18%2017.999-18H62v-4.09c8.016-.722%2014.787-5.738%2018-12.73v7.434c-3.545%204.262-8.426%207.374-14%208.69V74h-5.993C52.275%2074%2046%2080.268%2046%2088h-4zm-4%200c0-9.943-8.058-18-17.999-18H18v-4.09c-8.012-.722-14.785-5.738-18-12.73v7.434c3.545%204.262%208.426%207.374%2014%208.69V74h5.993C27.729%2074%2034%2080.266%2034%2088h4zm4-88c0%209.943%208.058%2018%2017.999%2018H62v4.09c8.012.722%2014.785%205.738%2018%2012.73v-7.434c-3.545-4.262-8.426-7.374-14-8.69V14h-5.993C52.271%2014%2046%207.734%2046%200h-4zM0%2034.82c3.213-6.992%209.984-12.008%2018-12.73V18h2.001C29.94%2018%2038%209.941%2038%200h-4c0%207.732-6.275%2014-14.007%2014H14v4.696c-5.574%201.316-10.455%204.428-14%208.69v7.433z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    deathStar: { label: "Death Star", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%22105%22%20viewBox%3D%220%200%2080%20105%22%3E%3Cpath%20d%3D%22M20%2010a5%205%200%200%201%2010%200v50a5%205%200%200%201-10%200V10zm15%2035a5%205%200%200%201%2010%200v50a5%205%200%200%201-10%200V45zM20%2075a5%205%200%200%201%2010%200v20a5%205%200%200%201-10%200V75zm30-65a5%205%200%200%201%2010%200v50a5%205%200%200%201-10%200V10zm0%2065a5%205%200%200%201%2010%200v20a5%205%200%200%201-10%200V75zM35%2010a5%205%200%200%201%2010%200v20a5%205%200%200%201-10%200V10zM5%2045a5%205%200%200%201%2010%200v50a5%205%200%200%201-10%200V45zm0-35a5%205%200%200%201%2010%200v20a5%205%200%200%201-10%200V10zm60%2035a5%205%200%200%201%2010%200v50a5%205%200%200%201-10%200V45zm0-35a5%205%200%200%201%2010%200v20a5%205%200%200%201-10%200V10z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    hideout: { label: "Hideout", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cpath%20d%3D%22M0%2038.59l2.83-2.83%201.41%201.41L1.41%2040H0v-1.41zM0%201.4l2.83%202.83%201.41-1.41L1.41%200H0v1.41zM38.59%2040l-2.83-2.83%201.41-1.41L40%2038.59V40h-1.41zM40%201.41l-2.83%202.83-1.41-1.41L38.59%200H40v1.41zM20%2018.6l2.83-2.83%201.41%201.41L21.41%2020l2.83%202.83-1.41%201.41L20%2021.41l-2.83%202.83-1.41-1.41L18.59%2020l-2.83-2.83%201.41-1.41L20%2018.59z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    charlieBrown: { label: "Charlie Brown", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2212%22%20viewBox%3D%220%200%2020%2012%22%3E%3Cpath%20d%3D%22M9.8%2012L0%202.2V.8l10%2010%2010-10v1.4L10.2%2012h-.4zm-4%200L0%206.2V4.8L7.2%2012H5.8zm8.4%200L20%206.2V4.8L12.8%2012h1.4zM9.8%200l.2.2.2-.2h-.4zm-4%200L10%204.2%2014.2%200h-1.4L10%202.8%207.2%200H5.8z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    signal: { label: "Signal", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2284%22%20height%3D%2248%22%20viewBox%3D%220%200%2084%2048%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Esignal%3C%2Ftitle%3E%3Cpath%20d%3D%22M0%200h12v6H0V0zm28%208h12v6H28V8zm14-8h12v6H42V0zm14%200h12v6H56V0zm0%208h12v6H56V8zM42%208h12v6H42V8zm0%2016h12v6H42v-6zm14-8h12v6H56v-6zm14%200h12v6H70v-6zm0-16h12v6H70V0zM28%2032h12v6H28v-6zM14%2016h12v6H14v-6zM0%2024h12v6H0v-6zm0%208h12v6H0v-6zm14%200h12v6H14v-6zm14%208h12v6H28v-6zm-14%200h12v6H14v-6zm28%200h12v6H42v-6zm14-8h12v6H56v-6zm0-8h12v6H56v-6zm14%208h12v6H70v-6zm0%208h12v6H70v-6zM14%2024h12v6H14v-6zm14-8h12v6H28v-6zM14%208h12v6H14V8zM0%208h12v6H0V8z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    anchorsAway: { label: "Anchors", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M12.392%2014v15.95c-3.278-.325-6.09-2.233-7.66-4.95l3.464-2L0%2020.804%202.885%2025.8C4.93%2029.498%208.87%2032%2013.392%2032c4.524%200%208.463-2.503%2010.508-6.2l2.885-4.996L18.588%2023l3.466%202c-1.57%202.717-4.384%204.625-7.662%204.95V14h5v-2h-5V7.874c1.726-.444%203-2.01%203-3.874%200-2.21-1.79-4-4-4s-4%201.79-4%204c0%201.864%201.275%203.43%203%203.874V12h-5v2h5zm1-8c1.105%200%202-.895%202-2s-.895-2-2-2c-1.104%200-2%20.895-2%202s.896%202%202%202zm39%2048v15.95c-3.278-.325-6.09-2.233-7.66-4.95l3.464-2L40%2060.804l2.885%204.997C44.93%2069.498%2048.87%2072%2053.392%2072c4.524%200%208.463-2.503%2010.508-6.2l2.885-4.996L58.588%2063l3.466%202c-1.57%202.717-4.384%204.625-7.662%204.95V54h5v-2h-5v-4.126c1.726-.444%203-2.01%203-3.874%200-2.21-1.79-4-4-4s-4%201.79-4%204c0%201.864%201.275%203.43%203%203.874V52h-5v2h5zm1-8c1.105%200%202-.895%202-2s-.895-2-2-2c-1.104%200-2%20.895-2%202s.896%202%202%202zm-40%2014c1.105%200%202-.895%202-2s-.895-2-2-2c-1.104%200-2%20.895-2%202s.896%202%202%202zm40-40c1.105%200%202-.895%202-2s-.895-2-2-2c-1.104%200-2%20.895-2%202s.896%202%202%202z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    fallingTriangles: { label: "Triangles", uri: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2236%22%20height%3D%2272%22%20viewBox%3D%220%200%2036%2072%22%3E%3Cpath%20d%3D%22M2%206h12L8%2018%202%206zm18%2036h12l-6%2012-6-12z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" },
    endlessClouds: { label: "Clouds", uri: "url('data:image/svg+xml,%3Csvg%20width%3D%2256%22%20height%3D%2228%22%20viewBox%3D%220%200%2056%2028%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3Eclouds%3C%2Ftitle%3E%3Cpath%20d%3D%22M56%2026c-2.813%200-5.456.726-7.752%202H56v-2zm-26%202h4.087C38.707%2020.783%2046.795%2016%2056%2016v-2c-.672%200-1.339.024-1.999.07L54%2014c0-1.105.895-2%202-2v-2c-2.075%200-3.78%201.58-3.98%203.602-.822-1.368-1.757-2.66-2.793-3.862C50.644%207.493%2053.147%206%2056%206V4c-3.375%200-6.359%201.672-8.17%204.232-.945-.948-1.957-1.828-3.03-2.634C47.355%202.198%2051.42%200%2056%200h-7.752c-1.998%201.108-3.733%202.632-5.09%204.454-1.126-.726-2.307-1.374-3.536-1.936.63-.896%201.33-1.738%202.095-2.518H39.03c-.46.557-.893%201.137-1.297%201.737-1.294-.48-2.633-.866-4.009-1.152.12-.196.24-.392.364-.585H30l-.001.07C29.339.024%2028.672%200%2028%200c-.672%200-1.339.024-1.999.07L26%200h-4.087c.124.193.245.389.364.585-1.376.286-2.715.673-4.009%201.152-.404-.6-.837-1.18-1.297-1.737h-2.688c.764.78%201.466%201.622%202.095%202.518-1.23.562-2.41%201.21-3.536%201.936C11.485%202.632%209.75%201.108%207.752%200H0c4.58%200%208.645%202.199%2011.2%205.598-1.073.806-2.085%201.686-3.03%202.634C6.359%205.672%203.375%204%200%204v2c2.852%200%205.356%201.493%206.773%203.74-1.036%201.203-1.971%202.494-2.793%203.862C3.78%2011.58%202.075%2010%200%2010v2c1.105%200%202%20.895%202%202l-.001.07C1.339%2014.024.672%2014%200%2014v2c9.205%200%2017.292%204.783%2021.913%2012H26c0-1.105.895-2%202-2s2%20.895%202%202zM7.752%2028C5.456%2026.726%202.812%2026%200%2026v2h7.752zM56%2020c-6.832%200-12.936%203.114-16.971%208h2.688c3.63-3.703%208.688-6%2014.283-6v-2zm-39.029%208C12.936%2023.114%206.831%2020%200%2020v2c5.595%200%2010.653%202.297%2014.283%206h2.688zm15.01-.398c.821-1.368%201.756-2.66%202.792-3.862C33.356%2021.493%2030.853%2020%2028%2020c-2.852%200-5.356%201.493-6.773%203.74%201.036%201.203%201.971%202.494%202.793%203.862C24.22%2025.58%2025.925%2024%2028%2024s3.78%201.58%203.98%203.602zm14.287-11.865C42.318%209.864%2035.61%206%2028%206c-7.61%200-14.318%203.864-18.268%209.737-1.294-.48-2.633-.866-4.009-1.152C10.275%207.043%2018.548%202%2028%202c9.452%200%2017.725%205.043%2022.277%2012.585-1.376.286-2.715.673-4.009%201.152zm-5.426%202.717c1.126-.726%202.307-1.374%203.536-1.936C40.76%2011.367%2034.773%208%2028%208s-12.76%203.367-16.378%208.518c1.23.562%202.41%201.21%203.536%201.936C18.075%2014.537%2022.741%2012%2028%2012s9.925%202.537%2012.842%206.454zm-4.672%203.778c.945-.948%201.957-1.828%203.03-2.634C36.645%2016.198%2032.58%2014%2028%2014c-4.58%200-8.645%202.199-11.2%205.598%201.073.806%202.085%201.686%203.03%202.634C21.641%2019.672%2024.625%2018%2028%2018s6.359%201.672%208.17%204.232z%22%20fill%3D%22%23a1b2c3%22%20fill-opacity%3D%220.987%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')" }
  };
  const PATTERN_OPACITY = { subtle: 0.1, medium: 0.2, bold: 0.32 };
  const DITHER_INTENSITIES = ["subtle", "medium", "bold"];
  const GRADIENT_TYPES = ["flow", "retro", "linear", "pixel"];
  const GRADIENT_TYPE_LABELS = {
    flow: "Flow",
    linear: "Linear",
    retro: "Retro",
    pixel: "Pixel"
  };
  const GRADIENT_SOURCES = ["palette", "custom"];
  const GRADIENT_MOTIONS = ["off", "slow", "medium"];
  const GRADIENT_PALETTE_KEYS = ["background", "surface", "panel", "accent"];

  function patternImageValue(key, accentHex, intensity){
    const p = BG_PATTERNS[key];
    if (!p || !p.uri) return "";
    const hex = String(accentHex || "#6d4df6").replace("#", "");
    const opacity = PATTERN_OPACITY[intensity] ?? PATTERN_OPACITY.medium;
    return p.uri.replace("a1b2c3", hex).replace("0.987", String(opacity));
  }

  const DEFAULT_CONFIG = {
    version: 12,
    tint: "midnight",
    colors: {
      background: "#0d0d0d",
      surface: "#090d15",
      panel: "#191b24",
      text: "#e8ecfb",
      chatText: "#d4defd",
      accent: "#191434"
    },
    // Optional tiled page backdrop (Hero Patterns) drawn with the palette's
    // background + accent colors. pattern "none" = flat background.
    background: {
      pattern: "none",
      intensity: "medium"
    },
    material: {
      dither: false,
      ditherIntensity: "subtle"
    },
    // Optional CSS-native color path. Palette mode follows the existing theme
    // swatches automatically; custom mode gives each of the four stops its own
    // color. Disabled by default so older channel themes render identically.
    gradient: {
      enabled: false,
      type: "flow",
      source: "palette",
      stops: [
        { color: "#0d0d0d", position: 13 },
        { color: "#090d15", position: 38 },
        { color: "#191b24", position: 63 },
        { color: "#191434", position: 88 }
      ],
      balance: [25, 50, 75],
      angle: 135,
      strength: 34,
      soften: 18,
      noise: 8,
      motion: "slow",
      targets: { page: true, panels: true, navbar: true }
    },
    // Channel-wide event countdown banner (feature:event-countdown).
    // startsAtMs is the UTC epoch; startsAtLocal only repopulates the
    // owner's datetime-local input.
    event: {
      enabled: false,
      title: "",
      startsAtLocal: "",
      startsAtMs: 0
    },
    slider: {
      enabled: false,
      feedUrl: ""
    },
    typography: {
      preset: "inter",
      customFamily: ""
    },
    integrations: {
      enabled: true,
      tmdb: {
        apiKey: ""
      },
      klipy: {
        apiKey: ""
      },
      wyzie: {
        apiKey: ""
      },
      subdl: {
        apiKey: ""
      },
      ratings: {
        endpoint: ""
      },
      movieInfo: {
        enabled: false
      },
      autoSubs: {
        enabled: false
      },
      audioEnhancer: {
        enabled: false
      }
    },
    resources: {
      scripts: [],
      styles: [],
      modules: []
    },
    branding: {
      headerName: "CyTube",
      faviconUrl: "",
      posterUrl: ""
    },
    // Emote Marketplace: channel-owner-selected emote packs loaded from CDNs
    // (7TV / BetterTTV / emoji.gg). Each entry: { provider, id, label, enabled }.
    emotePacks: [],
    // Movie poll: enhance CyTube polls with TMDB movie poster cards
    // (feature:movie-poll). Uses the TMDB key from Integrations.
    moviePoll: { enabled: false },
    // Public TMDB list used by the playlist catalogue. The TMDB account session
    // is intentionally local-only and never stored in this channel config.
    playlistCatalog: { enabled: false, tmdbListUrl: "" }
  };

  const TINT_PRESETS = {
    // --- Curated: modern, restrained palettes that stay clear of the
    //     saturated "Themed"/"Editor" hues (blue, purple, magenta, pink,
    //     green, teal, red, gold). Neutrals + under-used hues. ---
    midnight: {
      name: "Graphite",
      colors: {
        background: "#0c0d0f",
        surface: "#141519",
        panel: "#1e2026",
        text: "#f3f4f7",
        chatText: "#c4c8d0",
        accent: "#b9c0cc"
      }
    },
    aurora: {
      name: "Slate",
      colors: {
        background: "#0b0e13",
        surface: "#12161d",
        panel: "#1c2129",
        text: "#e9edf4",
        chatText: "#c0c8d4",
        accent: "#7f9cc4"
      }
    },
    mocha: {
      name: "Mocha",
      colors: {
        background: "#100b08",
        surface: "#19120d",
        panel: "#241a13",
        text: "#f4ece3",
        chatText: "#d9c8b6",
        accent: "#cf9b6b"
      }
    },
    ember: {
      name: "Amber",
      colors: {
        background: "#120c05",
        surface: "#1c1409",
        panel: "#281d0d",
        text: "#fcefdc",
        chatText: "#f0d3ad",
        accent: "#f5a524"
      }
    },
    sunset: {
      name: "Blush",
      colors: {
        background: "#130a0e",
        surface: "#1d1017",
        panel: "#281721",
        text: "#fceaef",
        chatText: "#f1c9d4",
        accent: "#e891a6"
      }
    },
    citron: {
      name: "Citron",
      colors: {
        background: "#0d0f0a",
        surface: "#151810",
        panel: "#20251a",
        text: "#f2f6e9",
        chatText: "#d3dbc3",
        accent: "#bdf263"
      }
    },
    cyberpunk: {
      name: "Cyberpunk 2077",
      colors: {
        background: "#07020d",
        surface: "#0f0518",
        panel: "#19082a",
        text: "#f1e2ff",
        chatText: "#d0a8ff",
        accent: "#ff2bd6"
      }
    },
    synthwave: {
      name: "Synthwave Sunset",
      colors: {
        background: "#1a0a30",
        surface: "#23104a",
        panel: "#2f1766",
        text: "#ffd7f3",
        chatText: "#ffb6e8",
        accent: "#ff6ec7"
      }
    },
    matrix: {
      name: "Matrix Terminal",
      colors: {
        background: "#000000",
        surface: "#040d05",
        panel: "#08180a",
        text: "#b8ffc6",
        chatText: "#7aef88",
        accent: "#00ff5a"
      }
    },
    vaporwave: {
      name: "Vaporwave Dream",
      colors: {
        background: "#160630",
        surface: "#1f0c48",
        panel: "#2b1466",
        text: "#f7d9ff",
        chatText: "#d8b8ff",
        accent: "#00f5d4"
      }
    },
    dracula: {
      name: "Dracula",
      colors: {
        background: "#15151f",
        surface: "#1d1d2e",
        panel: "#282a3e",
        text: "#f8f8f2",
        chatText: "#c5c8d6",
        accent: "#bd93f9"
      }
    },
    tokyoNight: {
      name: "Tokyo Night",
      colors: {
        background: "#0b0e16",
        surface: "#11141d",
        panel: "#1a1e2e",
        text: "#c0caf5",
        chatText: "#a9b1d6",
        accent: "#7aa2f7"
      }
    },
    nord: {
      name: "Nord Frost",
      colors: {
        background: "#1d2129",
        surface: "#252a35",
        panel: "#2e3440",
        text: "#eceff4",
        chatText: "#d8dee9",
        accent: "#88c0d0"
      }
    },
    crimsonNoir: {
      name: "Crimson Noir",
      colors: {
        background: "#0a0203",
        surface: "#120407",
        panel: "#1a070a",
        text: "#ffe9e9",
        chatText: "#ffc3c3",
        accent: "#e63946"
      }
    },
    forestGold: {
      name: "Forest & Gold",
      colors: {
        background: "#0a1410",
        surface: "#0f1c18",
        panel: "#162a23",
        text: "#ecf2e6",
        chatText: "#c8d8c3",
        accent: "#d4a017"
      }
    },
    bloodMoon: {
      name: "Blood Moon",
      colors: {
        background: "#170307",
        surface: "#22070d",
        panel: "#310b15",
        text: "#ffe1d6",
        chatText: "#ffb8a3",
        accent: "#ff4d2e"
      }
    }
  };

  const CRITICAL_FONT_WEIGHTS = [400, 500, 600];
  const GOOGLE_FONT_WEIGHT_QUERY = CRITICAL_FONT_WEIGHTS.join(";");

  const FONT_PRESETS = {
    inter: {
      name: "Inter",
      family: "'Inter', 'Segoe UI', sans-serif",
      google: `Inter:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    roboto: {
      name: "Roboto",
      family: "'Roboto', 'Segoe UI', sans-serif",
      google: `Roboto:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    poppins: {
      name: "Poppins",
      family: "'Poppins', 'Segoe UI', sans-serif",
      google: `Poppins:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    montserrat: {
      name: "Montserrat",
      family: "'Montserrat', 'Segoe UI', sans-serif",
      google: `Montserrat:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    opensans: {
      name: "Open Sans",
      family: "'Open Sans', 'Segoe UI', sans-serif",
      google: `Open+Sans:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    lato: {
      name: "Lato",
      family: "'Lato', 'Segoe UI', sans-serif",
      google: `Lato:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    nunito: {
      name: "Nunito",
      family: "'Nunito', 'Segoe UI', sans-serif",
      google: `Nunito:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    manrope: {
      name: "Manrope",
      family: "'Manrope', 'Segoe UI', sans-serif",
      google: `Manrope:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    outfit: {
      name: "Outfit",
      family: "'Outfit', 'Segoe UI', sans-serif",
      google: `Outfit:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    },
    urbanist: {
      name: "Urbanist",
      family: "'Urbanist', 'Segoe UI', sans-serif",
      google: `Urbanist:wght@${GOOGLE_FONT_WEIGHT_QUERY}`
    }
  };
  const FONT_DEFAULT_ID = "inter";
  const FONT_FALLBACK_FAMILY = FONT_PRESETS[FONT_DEFAULT_ID].family;
  const THEME_FONT_LINK_ID = "btfw-theme-font";
  const THEME_FONT_PRELOAD_LINK_ID = `${THEME_FONT_LINK_ID}-preload`;
  const THEME_FONT_PREVIEW_LINK_ID = `${THEME_FONT_LINK_ID}-preview`;
  const PREVIEW_FONT_WEIGHTS = [...CRITICAL_FONT_WEIGHTS];
  const previewFontLoadCache = new Map();
  const previewStylesheetPromises = new Map();

  const STYLE_ID = "btfw-theme-admin-style";
  const MODULE_FIELD_MIN = 3;
  const MODULE_FIELD_MAX = 10;
  const MODULE_INPUT_SELECTOR = '[data-role="module-inputs"]';
  const moduleWatcherRegistry = new WeakMap();
  const activeModuleWatchers = new Set();

  const LOADER_PATTERNS = [
    /\/\*\s*BillTube[\s\S]*?loader[\s\S]*?\*\//i,
    /\/\/\s*BillTube[\s\S]*?loader/i,
    /https?:\/\/billtube\.github\.io\/BillTube3\//i,
    /billtube-fw\.js/i,
    /\(function\s*\(\s*(?:W\s*,\s*D|window\s*,\s*document)\s*\)\s*\{[\s\S]*?CDN_BASE/i,
  ];

  function findLoaderStart(source){
    if (!source) return -1;
    for (const pattern of LOADER_PATTERNS) {
      const match = pattern.exec(source);
      if (match) {
        let index = match.index;
        if (pattern === LOADER_PATTERNS[2] || pattern === LOADER_PATTERNS[3]) {
          const commentIndex = source.lastIndexOf("/*", index);
          if (commentIndex !== -1 && commentIndex >= index - 200) {
            index = commentIndex;
          }
        }
        const lineStart = source.lastIndexOf("\n", index);
        if (lineStart !== -1) {
          index = lineStart + 1;
        } else {
          index = 0;
        }
        return index;

      }
    }
    return -1;
  }

  function joinSections(parts, ensureTrailingNewline){
    const filtered = (parts || [])
      .map(part => typeof part === "string" ? part : "")
      .filter(part => part.trim().length > 0);
    if (filtered.length === 0) {
      return ensureTrailingNewline ? "\n" : "";
    }
    let combined = filtered.join("\n\n");
    if (ensureTrailingNewline && !combined.endsWith("\n")) {
      combined += "\n";
    }
    return combined;
  }

  function removeRuntimeAsset(id){
    if (typeof document === "undefined") return;
    const existing = document.getElementById(id);
    if (existing?.parentElement) {
      existing.parentElement.removeChild(existing);
    } else {
      existing?.remove?.();
    }
  }

  function ensureRuntimeAsset(id, url, kind){
    if (typeof document === "undefined" || !document.head) return;
    if (!url) {
      removeRuntimeAsset(id);
      return;
    }

    const attr = kind === "style" ? "href" : "src";
    const existing = document.getElementById(id);

    if (existing) {
      const current = existing.getAttribute(attr) || "";
      if (kind === "style" && existing.tagName === "LINK") {
        if (current === url) return existing;
        existing.setAttribute(attr, url);
        return existing;
      }
      if (kind !== "style" && existing.tagName === "SCRIPT" && current === url) {
        return existing;
      }
      removeRuntimeAsset(id);
    }

    if (kind === "style") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.id = id;
      document.head.appendChild(link);
      return link;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.defer = true;
    script.id = id;
    document.head.appendChild(script);
    return script;
  }

  function pruneRuntimeAssets(prefix, keepCount){
    if (typeof document === "undefined") return;
    const nodes = Array.from(document.querySelectorAll(`[id^="${prefix}"]`));
    nodes.forEach(node => {
      const match = node.id.match(/(\d+)$/);
      if (!match) return;
      const index = Number(match[1]);
      if (Number.isNaN(index) || index < keepCount) return;
      if (node.parentElement) {
        node.parentElement.removeChild(node);
      } else {
        node.remove?.();
      }
    });
  }

  function applyRuntimeResources(theme){
    if (!theme || typeof theme !== "object") return;
    const resources = (theme.resources && typeof theme.resources === "object") ? theme.resources : {};
    const styles = Array.isArray(resources.styles) ? resources.styles : [];
    styles.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-style-${idx}`, url, "style"));
    pruneRuntimeAssets("btfw-theme-style-", styles.length);

    const scripts = Array.isArray(resources.scripts) ? resources.scripts : [];
    scripts.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-script-${idx}`, url, "script"));
    pruneRuntimeAssets("btfw-theme-script-", scripts.length);

    const modules = normalizeModuleUrls(collectModuleCandidates(theme));
    modules.forEach((url, idx) => ensureRuntimeAsset(`btfw-theme-module-${idx}`, url, "script"));
    pruneRuntimeAssets("btfw-theme-module-", modules.length);
    theme.resources = theme.resources || {};
    theme.resources.styles = styles.slice();
    theme.resources.scripts = scripts.slice();
    theme.resources.modules = modules;
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelThemeModules = modules.slice();
    }
  }

  function applyRuntimeSlider(theme){
    if (!theme || typeof theme !== "object") return;
    const slider = (theme.slider && typeof theme.slider === "object") ? theme.slider : (theme.slider = {});
    let enabled = typeof slider.enabled === "boolean" ? slider.enabled : theme.sliderEnabled;
    let feed = slider.feedUrl || slider.url || theme.sliderJson || "";
    enabled = Boolean(enabled);
    slider.enabled = enabled;
    slider.feedUrl = feed;
    theme.sliderEnabled = enabled;
    theme.sliderJson = feed;
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelSlider = { enabled, feedUrl: feed };
      global.channelSliderEnabled = enabled;
      global.channelSliderJSON = feed;
    }
  }

  function applyRuntimeBranding(theme){
    if (!theme || typeof theme !== "object") return;
    const branding = (theme.branding && typeof theme.branding === "object") ? theme.branding : (theme.branding = {});
    let name = typeof branding.headerName === "string" ? branding.headerName.trim() : "";
    if (!name && typeof theme.headerName === "string") {
      name = theme.headerName.trim();
    }
    if (!name) name = "CyTube";
    branding.headerName = name;

    const selectors = [
      "#nav-collapsible .navbar-brand",
      ".navbar .navbar-brand",
      ".navbar-brand",
      "#navbrand"
    ];
    selectors.forEach(sel => {
      const anchor = document?.querySelector?.(sel);
      if (!anchor) return;
      let holder = anchor.querySelector('[data-btfw-brand-text]');
      if (holder) {
        holder.textContent = name;
      } else {
        let replaced = false;
        Array.from(anchor.childNodes || []).forEach(node => {
          if (node && node.nodeType === 3) {
            const text = (node.textContent || "").trim();
            if (!text) return;
            if (!replaced) {
              node.textContent = name;
              replaced = true;
            } else {
              node.textContent = "";
            }
          }
        });
        if (!replaced) {
          holder = document.createElement("span");
          holder.dataset.btfwBrandText = "1";
          if (anchor.childNodes.length > 0) {
            anchor.appendChild(document.createTextNode(" "));
          }
          holder.textContent = name;
          anchor.appendChild(holder);
        }
      }
      anchor.setAttribute("title", name);
      anchor.setAttribute("aria-label", name);
    });

    let faviconUrl = typeof branding.faviconUrl === "string" ? branding.faviconUrl.trim() : "";
    if (!faviconUrl && typeof branding.favicon === "string") {
      faviconUrl = branding.favicon.trim();
    }
    branding.faviconUrl = faviconUrl || "";
    branding.favicon = branding.faviconUrl;
    if (faviconUrl && typeof document !== "undefined") {
      const linkSelectors = 'link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';
      const links = Array.from(document.querySelectorAll(linkSelectors));
      if (!links.length) {
        const created = document.createElement("link");
        created.rel = "icon";
        document.head?.appendChild(created);
        links.push(created);
      }
      links.forEach(link => {
        try { link.href = faviconUrl; } catch (_) {}
      });
    }

    let poster = typeof branding.posterUrl === "string" ? branding.posterUrl.trim() : "";
    if (!poster && typeof theme.branding?.posterUrl === "string") {
      poster = theme.branding.posterUrl.trim();
    }
    branding.posterUrl = poster || "";
    if (typeof window !== "undefined") {
      const global = window.BTFW = window.BTFW || {};
      global.channelPosterUrl = poster || "";
    }
  }

  function applyRuntimeIntegrations(theme){
    if (!theme || typeof theme !== "object") return;
    const integrations = (theme.integrations && typeof theme.integrations === "object") ? theme.integrations : (theme.integrations = {});
    if (typeof integrations.enabled !== "boolean") {
      integrations.enabled = true;
    }
    if (!integrations.tmdb || typeof integrations.tmdb !== "object") {
      integrations.tmdb = { apiKey: "" };
    }
    const key = typeof integrations.tmdb.apiKey === "string" ? integrations.tmdb.apiKey.trim() : "";
    integrations.tmdb.apiKey = key;
    if (!integrations.klipy || typeof integrations.klipy !== "object") {
      integrations.klipy = { apiKey: "" };
    }
    const klipyKey = typeof integrations.klipy.apiKey === "string" ? integrations.klipy.apiKey.trim() : "";
    integrations.klipy.apiKey = klipyKey;
    if (!integrations.wyzie || typeof integrations.wyzie !== "object") {
      integrations.wyzie = { apiKey: "" };
    }
    const wyzieKey = typeof integrations.wyzie.apiKey === "string" ? integrations.wyzie.apiKey.trim() : "";
    integrations.wyzie.apiKey = wyzieKey;
    if (!integrations.subdl || typeof integrations.subdl !== "object") {
      integrations.subdl = { apiKey: "" };
    }
    const subdlKey = typeof integrations.subdl.apiKey === "string" ? integrations.subdl.apiKey.trim() : "";
    integrations.subdl.apiKey = subdlKey;
    if (!integrations.ratings || typeof integrations.ratings !== "object") {
      integrations.ratings = { endpoint: "" };
    }
    const ratingsEndpoint = typeof integrations.ratings.endpoint === "string" ? integrations.ratings.endpoint.trim() : "";
    integrations.ratings.endpoint = ratingsEndpoint;

    if (!integrations.movieInfo || typeof integrations.movieInfo !== "object") {
      integrations.movieInfo = { enabled: false };
    }
    const movieInfoEnabled = Boolean(integrations.movieInfo.enabled);
    integrations.movieInfo.enabled = movieInfoEnabled;

    if (!integrations.autoSubs || typeof integrations.autoSubs !== "object") {
      integrations.autoSubs = { enabled: false };
    }
    const autoSubsEnabled = Boolean(integrations.autoSubs.enabled);
    integrations.autoSubs.enabled = autoSubsEnabled;

    if (!integrations.audioEnhancer || typeof integrations.audioEnhancer !== "object") {
      integrations.audioEnhancer = { enabled: false };
    }
    const audioEnhancerEnabled = Boolean(integrations.audioEnhancer.enabled);
    integrations.audioEnhancer.enabled = audioEnhancerEnabled;
    if (typeof window !== "undefined") {
      window.BTFW_CONFIG = window.BTFW_CONFIG || {};
      if (typeof window.BTFW_CONFIG.tmdb !== "object") {
        window.BTFW_CONFIG.tmdb = {};
      }
      window.BTFW_CONFIG.tmdb.apiKey = key;
      window.BTFW_CONFIG.tmdbKey = key;
      window.BTFW_CONFIG.klipy = window.BTFW_CONFIG.klipy || {};
      window.BTFW_CONFIG.klipy.apiKey = klipyKey;
      window.BTFW_CONFIG.klipyKey = klipyKey;
      window.BTFW_CONFIG.wyzie = window.BTFW_CONFIG.wyzie || {};
      window.BTFW_CONFIG.wyzie.apiKey = wyzieKey;
      window.BTFW_CONFIG.wyzieKey = wyzieKey;
      window.BTFW_CONFIG.subdl = window.BTFW_CONFIG.subdl || {};
      window.BTFW_CONFIG.subdl.apiKey = subdlKey;
      window.BTFW_CONFIG.subdlKey = subdlKey;
      window.BTFW_CONFIG.integrationsEnabled = integrations.enabled;
      if (typeof window.BTFW_CONFIG.ratings !== "object") {
        window.BTFW_CONFIG.ratings = {};
      }
      window.BTFW_CONFIG.ratings.endpoint = ratingsEndpoint;
      window.BTFW_CONFIG.ratingsEndpoint = ratingsEndpoint;
      window.BTFW_CONFIG.shouldLoadRatings = Boolean(ratingsEndpoint);
      if (typeof window.BTFW_CONFIG.integrations !== "object") {
        window.BTFW_CONFIG.integrations = {};
      }
      window.BTFW_CONFIG.integrations.movieInfo = window.BTFW_CONFIG.integrations.movieInfo || {};
      window.BTFW_CONFIG.integrations.movieInfo.enabled = movieInfoEnabled;
      window.BTFW_CONFIG.integrations.autoSubs = window.BTFW_CONFIG.integrations.autoSubs || {};
      window.BTFW_CONFIG.integrations.autoSubs.enabled = autoSubsEnabled;
      window.BTFW_CONFIG.integrations.klipy = window.BTFW_CONFIG.integrations.klipy || {};
      window.BTFW_CONFIG.integrations.klipy.apiKey = klipyKey;
      window.BTFW_CONFIG.integrations.wyzie = window.BTFW_CONFIG.integrations.wyzie || {};
      window.BTFW_CONFIG.integrations.wyzie.apiKey = wyzieKey;
      window.BTFW_CONFIG.integrations.subdl = window.BTFW_CONFIG.integrations.subdl || {};
      window.BTFW_CONFIG.integrations.subdl.apiKey = subdlKey;
      window.BTFW_CONFIG.integrations.audioEnhancer = window.BTFW_CONFIG.integrations.audioEnhancer || {};
      window.BTFW_CONFIG.integrations.audioEnhancer.enabled = audioEnhancerEnabled;
      window.BTFW_CONFIG.movieInfo = window.BTFW_CONFIG.movieInfo || {};
      window.BTFW_CONFIG.movieInfo.enabled = movieInfoEnabled;
      window.BTFW_CONFIG.movieInfoEnabled = movieInfoEnabled;
      window.BTFW_CONFIG.shouldLoadMovieInfo = movieInfoEnabled;
      window.BTFW_CONFIG.autoSubs = window.BTFW_CONFIG.autoSubs || {};
      window.BTFW_CONFIG.autoSubs.enabled = autoSubsEnabled;
      window.BTFW_CONFIG.autoSubsEnabled = autoSubsEnabled;
      window.BTFW_CONFIG.shouldLoadAutoSubs = autoSubsEnabled;
      window.BTFW_CONFIG.audioEnhancer = window.BTFW_CONFIG.audioEnhancer || {};
      window.BTFW_CONFIG.audioEnhancer.enabled = audioEnhancerEnabled;
      window.BTFW_CONFIG.audioEnhancerEnabled = audioEnhancerEnabled;
      window.BTFW_CONFIG.shouldLoadAudioEnhancer = audioEnhancerEnabled;
      if (ratingsEndpoint) {
        window.BTFW_RATINGS_ENDPOINT = ratingsEndpoint;
      } else {
        try { delete window.BTFW_RATINGS_ENDPOINT; } catch (_) { window.BTFW_RATINGS_ENDPOINT = ""; }
      }
      try {
        if (document?.body && document.body.dataset.tmdbKey !== key) {
          document.body.dataset.tmdbKey = key;
        }
        if (document?.body) {
          if (klipyKey) document.body.dataset.klipyKey = klipyKey;
          else if (document.body.dataset?.klipyKey) delete document.body.dataset.klipyKey;
        }
        if (document?.body) {
          if (wyzieKey) document.body.dataset.wyzieKey = wyzieKey;
          else if (document.body.dataset?.wyzieKey) delete document.body.dataset.wyzieKey;
        }
        if (document?.body) {
          if (subdlKey) document.body.dataset.subdlKey = subdlKey;
          else if (document.body.dataset?.subdlKey) delete document.body.dataset.subdlKey;
        }
        if (document?.body) {
          if (ratingsEndpoint) {
            document.body.dataset.btfwRatingsEndpoint = ratingsEndpoint;
          } else if (document.body.dataset?.btfwRatingsEndpoint) {
            delete document.body.dataset.btfwRatingsEndpoint;
          }
          if (movieInfoEnabled) {
            document.body.dataset.btfwMovieInfoEnabled = "1";
          } else if (document.body.dataset?.btfwMovieInfoEnabled) {
            delete document.body.dataset.btfwMovieInfoEnabled;
          }
          if (autoSubsEnabled) {
            document.body.dataset.btfwAutoSubsEnabled = "1";
          } else if (document.body.dataset?.btfwAutoSubsEnabled) {
            delete document.body.dataset.btfwAutoSubsEnabled;
          }
          if (audioEnhancerEnabled) {
            document.body.dataset.btfwAudioEnhancerEnabled = "1";
          } else if (document.body.dataset?.btfwAudioEnhancerEnabled) {
            delete document.body.dataset.btfwAudioEnhancerEnabled;
          }
        }
      } catch (_) {}
    }
    try {
      document?.dispatchEvent?.(new CustomEvent("btfw:channelIntegrationsChanged", {
        detail: {
          enabled: integrations.enabled,
          tmdbKey: key,
          klipyKey,
          wyzieKey,
          subdlKey,
          ratingsEndpoint,
          movieInfoEnabled,
          autoSubsEnabled,
          audioEnhancerEnabled
        }
      }));
    } catch (_) {}
  }

  function applyRuntimeColors(theme){
    if (!theme || typeof theme !== "object" || typeof document === "undefined") return;
    const colors = (theme.colors && typeof theme.colors === "object") ? theme.colors : (theme.colors = {});
    const root = document.documentElement;
    if (!root) return;
    const bg = colors.background || "#05060d";
    const surface = colors.surface || colors.panel || "#0b111d";
    const panel = colors.panel || "#141f36";
    const text = colors.text || "#e8ecfb";
    const chatText = colors.chatText || text;
    const accent = colors.accent || "#6d4df6";
    colors.background = bg;
    colors.surface = surface;
    colors.panel = panel;
    colors.text = text;
    colors.chatText = chatText;
    colors.accent = accent;
    const map = {
      "--btfw-theme-bg": bg,
      "--btfw-theme-surface": surface,
      "--btfw-theme-panel": panel,
      "--btfw-theme-text": text,
      "--btfw-theme-chat-text": chatText,
      "--btfw-theme-accent": accent,
    };
    Object.keys(map).forEach(key => {
      if (map[key]) {
        root.style.setProperty(key, map[key]);
      }
    });
    root.setAttribute("data-btfw-theme-tint", theme.tint || "custom");
    try {
      document.dispatchEvent(new CustomEvent("btfw:channelThemeTint", {
        detail: {
          tint: theme.tint || "custom",
          colors: { bg, surface, panel, text, chat: chatText, accent },
          config: theme,
        }
      }));
    } catch (_) {}
  }

  function applyRuntimeMaterial(theme){
    if (!theme || typeof theme !== "object" || typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root) return;
    const material = theme.material && typeof theme.material === "object"
      ? theme.material
      : (theme.material = JSON.parse(JSON.stringify(DEFAULT_CONFIG.material)));
    material.dither = Boolean(material.dither);
    if (!DITHER_INTENSITIES.includes(material.ditherIntensity)) {
      material.ditherIntensity = "subtle";
    }
    root.setAttribute("data-btfw-dither", material.dither ? material.ditherIntensity : "off");
  }

  function clampGradientNumber(value, min, max, fallback){
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeGradientConfig(theme){
    if (!theme || typeof theme !== "object") return JSON.parse(JSON.stringify(DEFAULT_CONFIG.gradient));
    const defaults = DEFAULT_CONFIG.gradient;
    const gradient = theme.gradient && typeof theme.gradient === "object"
      ? theme.gradient
      : (theme.gradient = JSON.parse(JSON.stringify(defaults)));
    gradient.enabled = Boolean(gradient.enabled);
    if (gradient.type === "radial") gradient.type = "retro";
    if (["mesh", "conic", "rings", "ios"].includes(gradient.type)) gradient.type = "flow";
    if (!GRADIENT_TYPES.includes(gradient.type)) gradient.type = defaults.type;
    if (!GRADIENT_SOURCES.includes(gradient.source)) gradient.source = defaults.source;
    gradient.angle = Math.round(clampGradientNumber(gradient.angle, 0, 360, defaults.angle));
    gradient.strength = Math.round(clampGradientNumber(gradient.strength, 20, 72, defaults.strength));
    gradient.soften = Math.round(clampGradientNumber(gradient.soften, 0, 80, defaults.soften));
    gradient.noise = Math.round(clampGradientNumber(gradient.noise, 0, 100, defaults.noise));
    if (!GRADIENT_MOTIONS.includes(gradient.motion)) gradient.motion = defaults.motion;
    if (!gradient.targets || typeof gradient.targets !== "object") {
      gradient.targets = { ...defaults.targets };
    }
    gradient.targets.page = gradient.targets.page !== false;
    gradient.targets.panels = gradient.targets.panels !== false;
    gradient.targets.navbar = gradient.targets.navbar !== false;

    const incomingBalance = Array.isArray(gradient.balance) ? gradient.balance : [];
    const balance = [];
    defaults.balance.forEach((fallback, index) => {
      const lower = index === 0 ? 6 : balance[index - 1] + 6;
      const upper = 100 - ((defaults.balance.length - index) * 6);
      balance.push(Math.round(clampGradientNumber(incomingBalance[index], lower, upper, fallback)));
    });
    gradient.balance = balance;

    const edges = [0, ...balance, 100];
    const incomingStops = Array.isArray(gradient.stops) ? gradient.stops : [];
    gradient.stops = defaults.stops.map((fallback, index) => {
      const stop = incomingStops[index] && typeof incomingStops[index] === "object" ? incomingStops[index] : {};
      const color = /^#[0-9a-f]{6}$/i.test(String(stop.color || "")) ? String(stop.color) : fallback.color;
      return {
        color,
        position: Math.round((edges[index] + edges[index + 1]) / 2)
      };
    });
    return gradient;
  }

  function getGradientStops(theme){
    const gradient = normalizeGradientConfig(theme);
    const colors = theme.colors && typeof theme.colors === "object" ? theme.colors : DEFAULT_CONFIG.colors;
    return gradient.stops.map((stop, index) => ({
      color: gradient.source === "palette"
        ? (colors[GRADIENT_PALETTE_KEYS[index]] || DEFAULT_CONFIG.colors[GRADIENT_PALETTE_KEYS[index]])
        : stop.color,
      position: stop.position,
      paletteKey: GRADIENT_PALETTE_KEYS[index]
    }));
  }

  function gradientSvgUrl(content){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice">${content}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function gradientSvgLayer(content){
    return {
      css: gradientSvgUrl(content),
      count: 1,
      sizes: ["cover"],
      positions: ["center"]
    };
  }

  function gradientHexRgb(hex){
    const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!match) return [0, 0, 0];
    return [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16));
  }

  function gradientRgbHex(rgb){
    return `#${rgb.map(channel => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("")}`;
  }

  function gradientColorAt(stops, progress){
    const value = Math.min(1, Math.max(0, progress));
    const positioned = stops.map(stop => ({ ...stop, unit: stop.position / 100 }));
    if (value <= positioned[0].unit) return positioned[0].color;
    if (value >= positioned[positioned.length - 1].unit) return positioned[positioned.length - 1].color;
    const upperIndex = positioned.findIndex(stop => stop.unit >= value);
    const lower = positioned[Math.max(0, upperIndex - 1)];
    const upper = positioned[upperIndex];
    const span = Math.max(0.001, upper.unit - lower.unit);
    const mix = (value - lower.unit) / span;
    const a = gradientHexRgb(lower.color);
    const b = gradientHexRgb(upper.color);
    return gradientRgbHex(a.map((channel, index) => channel + ((b[index] - channel) * mix)));
  }

  function renderPixelQuilt(stops, opacity, motion){
    const animation = gradientSvgMotion(motion, "pixel");
    const columns = 17;
    const rows = 11;
    const cell = 80;
    const levels = Array.from({ length: 9 }, (_, index) => gradientColorAt(stops, index / 8));
    const paths = levels.map(() => []);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const field = (
          Math.sin((column + 1) * 0.73) +
          Math.cos((row + 1) * 0.91) +
          Math.sin((column + row + 2) * 0.39) + 3
        ) / 6;
        const level = Math.round(Math.min(1, Math.max(0, field)) * (levels.length - 1));
        paths[level].push(`M${(column - 1) * cell} ${(row - 1) * cell}h${cell}v${cell}h-${cell}z`);
      }
    }
    const tiles = paths.map((parts, index) => parts.length ? `<path d="${parts.join("")}" fill="${levels[index]}"/>` : "").join("");
    return gradientSvgLayer(`${animation.style}<defs><pattern id="q" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 80V0h80" fill="none" stroke="#fff" stroke-opacity=".12"/><path d="M0 80h80V0" fill="none" stroke="#000" stroke-opacity=".2"/></pattern></defs><g${animation.attribute} opacity="${opacity}">${tiles}<rect x="-80" y="-80" width="1360" height="880" fill="url(#q)"/></g>`);
  }

  function gradientSvgMotion(motion, kind){
    if (!motion || motion === "off") return { style: "", attribute: "" };
    const pixel = kind === "pixel";
    const duration = pixel ? (motion === "medium" ? 8 : 14) : (motion === "medium" ? 10 : 18);
    const timing = pixel ? "steps(8,end)" : "ease-in-out";
    const frames = pixel
      ? "0%{transform:translate(-80px,-80px)}50%{transform:translate(0,-80px)}100%{transform:translate(0,0)}"
      : "0%,100%{transform:translate(-24px,-14px) scale(1.05)}50%{transform:translate(26px,16px) scale(1.08)}";
    return {
      style: `<style>@keyframes btfwGradientMotion{${frames}}.btfw-gradient-motion{transform-box:fill-box;transform-origin:center;animation:btfwGradientMotion ${duration}s ${timing} infinite alternate}@media (prefers-reduced-motion:reduce){.btfw-gradient-motion{animation:none}}</style>`,
      attribute: ` class="btfw-gradient-motion"`
    };
  }

  function renderGradientLayer(theme, strengthScale = 1){
    const gradient = normalizeGradientConfig(theme);
    const stops = getGradientStops(theme);
    const alpha = Math.round(clampGradientNumber(gradient.strength * strengthScale, 4, 72, 24));
    const opacity = (alpha / 100).toFixed(2);
    const colorAt = stop => `color-mix(in srgb, ${stop.color} ${alpha}%, transparent)`;
    const colorPath = stops.map(stop => `${colorAt(stop)} ${stop.position}%`).join(", ");

    if (gradient.type === "flow") {
      // SVG-native port of FeralUI's MIT Flow defaults: scale 50, distortion 60, swirl 10.
      const displacement = Math.round(96 + (gradient.soften * 0.72));
      const blur = Math.round(16 + (gradient.soften * 0.34));
      const duration = gradient.motion === "medium" ? 9 : 16;
      const motionStyle = gradient.motion === "off" ? "" : `<style>@keyframes flow0{0%,100%{transform:translate(-18px,12px) scale(1.02)}50%{transform:translate(24px,-16px) scale(1.07)}}@keyframes flow1{0%,100%{transform:translate(-34px,22px) rotate(-1.5deg)}50%{transform:translate(38px,-24px) rotate(1.8deg)}}@keyframes flow2{0%,100%{transform:translate(30px,-26px) scale(1.04)}50%{transform:translate(-40px,28px) scale(1.09)}}@keyframes flow3{0%,100%{transform:translate(22px,28px) rotate(1.2deg)}50%{transform:translate(-28px,-30px) rotate(-1.6deg)}}.flow-field{transform-box:fill-box;transform-origin:center;animation-duration:${duration}s;animation-timing-function:ease-in-out;animation-iteration-count:infinite}.flow-0{animation-name:flow0}.flow-1{animation-name:flow1;animation-delay:-${Math.round(duration * .24)}s}.flow-2{animation-name:flow2;animation-delay:-${Math.round(duration * .46)}s}.flow-3{animation-name:flow3;animation-delay:-${Math.round(duration * .68)}s}@media (prefers-reduced-motion:reduce){.flow-field{animation:none}}</style>`;
      const shapes = `<path class="flow-field flow-2" d="M590-160H1450V475C1225 465 1015 555 895 810C745 650 635 520 540 350C600 210 620 25 590-160Z" fill="${stops[2].color}"/><path class="flow-field flow-1" d="M-240 130C170 80 565 175 830 385C705 540 575 720 360 900H-240Z" fill="${stops[1].color}"/><path class="flow-field flow-0" d="M130-180H1450V20C1110 15 870 105 705 300C485 225 300 190 105 230C55 120 60-50 130-180Z" fill="${stops[0].color}"/>`;
      return gradientSvgLayer(`${motionStyle}<defs><filter id="f" filterUnits="userSpaceOnUse" x="-280" y="-240" width="1760" height="1200"><feTurbulence type="fractalNoise" baseFrequency=".004 .008" numOctaves="3" seed="17" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${displacement}" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g opacity="${opacity}"><rect width="1200" height="720" fill="${stops[3].color}"/><g filter="url(#f)">${shapes}</g></g>`);
    }

    if (gradient.type === "mesh") {
      const blur = Math.round(62 + (gradient.soften * 0.55));
      return gradientSvgLayer(`<defs><filter id="m" x="-35%" y="-50%" width="170%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g opacity="${opacity}"><rect width="1200" height="720" fill="${gradientColorAt(stops, .25)}" fill-opacity=".5"/><g filter="url(#m)"><ellipse cx="50" cy="95" rx="470" ry="335" fill="${stops[0].color}"/><ellipse cx="365" cy="690" rx="520" ry="345" fill="${stops[1].color}"/><ellipse cx="790" cy="50" rx="515" ry="330" fill="${stops[2].color}"/><ellipse cx="1200" cy="610" rx="535" ry="390" fill="${stops[3].color}"/><ellipse cx="645" cy="405" rx="380" ry="235" fill="${gradientColorAt(stops, .56)}" fill-opacity=".8"/></g></g>`);
    }

    if (gradient.type === "ios") {
      const animation = gradientSvgMotion(gradient.motion, "ios");
      const svgStops = stops.map(stop => `<stop offset="${stop.position}%" stop-color="${stop.color}"/>`).join("");
      return gradientSvgLayer(`${animation.style}<defs><linearGradient id="i" gradientUnits="userSpaceOnUse" x1="-100" y1="-60" x2="1300" y2="780">${svgStops}</linearGradient><radialGradient id="g" cx="12%" cy="8%" r="72%" fx="12%" fy="8%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><g${animation.attribute} opacity="${opacity}"><rect x="-100" y="-60" width="1400" height="840" fill="url(#i)"/><rect x="-100" y="-60" width="1400" height="840" fill="url(#g)"/></g>`);
    }

    if (gradient.type === "rings") {
      const melt = Math.round(8 + (gradient.soften * 0.45));
      const blur = Math.round(5 + (gradient.soften * 0.14));
      const rings = Array.from({ length: 12 }, (_, index) => `<circle cx="1450" cy="360" r="${90 + (index * 135)}" fill="none" stroke="${gradientColorAt(stops, index / 11)}" stroke-width="150"/>`).join("");
      const glowColor = color => gradientRgbHex(gradientHexRgb(color).map(channel => channel + ((255 - channel) * 0.58)));
      const glows = Array.from({ length: 12 }, (_, index) => `<circle cx="1450" cy="360" r="${90 + (index * 135)}" fill="none" stroke="${glowColor(gradientColorAt(stops, index / 11))}" stroke-opacity=".58" stroke-width="16"/>`).join("");
      return gradientSvgLayer(`<defs><filter id="r" filterUnits="userSpaceOnUse" x="-220" y="-220" width="3400" height="1160"><feTurbulence type="fractalNoise" baseFrequency=".003 .012" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${melt}" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="${blur}"/></filter><filter id="rg" filterUnits="userSpaceOnUse" x="-220" y="-220" width="3400" height="1160"><feTurbulence type="fractalNoise" baseFrequency=".003 .012" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${melt}" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="6"/></filter></defs><g opacity="${opacity}"><rect width="1200" height="720" fill="${stops[3].color}" fill-opacity=".5"/><g filter="url(#r)">${rings}</g><g filter="url(#rg)">${glows}</g></g>`);
    }

    if (gradient.type === "pixel") {
      return renderPixelQuilt(stops, opacity, gradient.motion);
    }

    if (gradient.type === "retro") {
      const rgbLight = stop => { const rgb = gradientHexRgb(stop.color); return (rgb[0] * 0.2126) + (rgb[1] * 0.7152) + (rgb[2] * 0.0722); };
      const brightestIndex = stops.reduce((best, stop, index) => rgbLight(stop) > rgbLight(stops[best]) ? index : best, 0);
      const centers = [[192, 590], [936, 187], [1056, 605], [288, 115]];
      const blur = Math.round(24 + (gradient.soften * 0.42));
      const grain = (0.045 + (gradient.noise / 900)).toFixed(3);
      const duration = gradient.motion === "medium" ? 10 : 18;
      const motionStyle = gradient.motion === "off" ? "" : `<style>@keyframes retroA{0%,100%{transform:translate(-34px,18px)}50%{transform:translate(42px,-28px)}}@keyframes retroB{0%,100%{transform:translate(28px,-24px)}50%{transform:translate(-38px,30px)}}.retro-blob{transform-box:fill-box;transform-origin:center;animation:retroA ${duration}s ease-in-out infinite}.retro-1,.retro-3{animation-name:retroB;animation-delay:-${Math.round(duration / 3)}s}@media (prefers-reduced-motion:reduce){.retro-blob{animation:none}}</style>`;
      const fields = stops.map((stop, index) => index === brightestIndex ? "" : `<radialGradient id="retro${index}"><stop offset="0" stop-color="${stop.color}" stop-opacity=".98"/><stop offset=".55" stop-color="${stop.color}" stop-opacity=".82"/><stop offset="1" stop-color="${stop.color}" stop-opacity="0"/></radialGradient>`).join("");
      const blobs = stops.map((stop, index) => index === brightestIndex ? "" : `<ellipse class="retro-blob retro-${index}" cx="${centers[index][0]}" cy="${centers[index][1]}" rx="540" ry="405" fill="url(#retro${index})"/>`).join("");
      return gradientSvgLayer(`${motionStyle}<defs>${fields}<filter id="retroWarp" x="-30%" y="-40%" width="170%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".006 .01" numOctaves="3" seed="11" result="warp"/><feDisplacementMap in="SourceGraphic" in2="warp" scale="88" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="${blur}"/></filter><filter id="retroGrain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="19"/><feColorMatrix type="saturate" values="0"/></filter></defs><g opacity="${opacity}"><rect width="1200" height="720" fill="${stops[brightestIndex].color}"/><g filter="url(#retroWarp)">${blobs}</g><rect width="1200" height="720" filter="url(#retroGrain)" opacity="${grain}" style="mix-blend-mode:soft-light"/></g>`);
    }

    if (gradient.type === "conic") {
      const forward = stops.map(stop => `${colorAt(stop)} ${(stop.position * 1.8).toFixed(1)}deg`);
      const reverse = [...stops].reverse().map(stop => `${colorAt(stop)} ${(360 - (stop.position * 1.8)).toFixed(1)}deg`);
      return { css: `conic-gradient(from ${gradient.angle}deg at 50% 50% in oklab, ${forward.concat(reverse).join(", ")})`, count: 1, sizes: ["cover"], positions: ["center"] };
    }
    return { css: `linear-gradient(${gradient.angle}deg in oklab, ${colorPath})`, count: 1, sizes: ["cover"], positions: ["center"] };
  }

  function gradientNoiseImage(amount){
    const value = Math.round(clampGradientNumber(amount, 0, 100, 0));
    if (!value) return "none";
    const opacity = Math.min(0.28, value / 360).toFixed(3);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="3" seed="11"/><feColorMatrix values="1 0 0 0 1 0 1 0 0 1 0 0 1 0 1 0 0 0 ${opacity} 0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".72"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function addGradientNoise(layer, amount){
    const noise = gradientNoiseImage(amount);
    if (noise === "none") return layer;
    return {
      css: `${noise}, ${layer.css}`,
      count: layer.count + 1,
      sizes: ["160px 160px", ...(layer.sizes || Array(layer.count).fill("auto"))],
      positions: ["0 0", ...(layer.positions || Array(layer.count).fill("center"))]
    };
  }

  function gradientLayerSizes(layer){
    return layer.sizes || Array(layer.count).fill("auto");
  }

  function gradientLayerPositions(layer){
    return layer.positions || Array(layer.count).fill("center");
  }

  function staticGradientTheme(theme){
    const gradient = normalizeGradientConfig(theme);
    return {
      ...theme,
      gradient: {
        ...gradient,
        motion: "off",
        balance: [...gradient.balance],
        stops: gradient.stops.map(stop => ({ ...stop }))
      }
    };
  }

  // Repeated UI surfaces stay single-layer and filter-free. That retains each
  // preset's character without placing animated SVG filters on every card,
  // modal and toolbar.
  function renderRuntimeSurfaceGradient(theme, strengthScale = 1){
    const gradient = normalizeGradientConfig(theme);
    const stops = getGradientStops(theme);
    const alpha = Math.round(clampGradientNumber(gradient.strength * strengthScale, 4, 72, 24));
    const opacity = (alpha / 100).toFixed(2);
    const path = stops.map(stop =>
      `color-mix(in srgb, ${stop.color} ${alpha}%, transparent) ${stop.position}%`
    ).join(", ");
    if (gradient.type === "flow") return gradientSvgLayer(`<g opacity="${opacity}"><rect width="1200" height="720" fill="${stops[3].color}"/><path d="M590-160H1450V475C1225 465 1015 555 895 810C745 650 635 520 540 350C600 210 620 25 590-160Z" fill="${stops[2].color}"/><path d="M-240 130C170 80 565 175 830 385C705 540 575 720 360 900H-240Z" fill="${stops[1].color}"/><path d="M130-180H1450V20C1110 15 870 105 705 300C485 225 300 190 105 230C55 120 60-50 130-180Z" fill="${stops[0].color}"/></g>`);
    if (gradient.type === "retro") return gradientSvgLayer(`<defs><radialGradient id="r0"><stop offset="0" stop-color="${stops[0].color}"/><stop offset="1" stop-color="${stops[0].color}" stop-opacity="0"/></radialGradient><radialGradient id="r1"><stop offset="0" stop-color="${stops[1].color}"/><stop offset="1" stop-color="${stops[1].color}" stop-opacity="0"/></radialGradient><radialGradient id="r2"><stop offset="0" stop-color="${stops[2].color}"/><stop offset="1" stop-color="${stops[2].color}" stop-opacity="0"/></radialGradient></defs><g opacity="${opacity}"><rect width="1200" height="720" fill="${stops[3].color}"/><ellipse cx="185" cy="585" rx="550" ry="410" fill="url(#r0)"/><ellipse cx="950" cy="175" rx="560" ry="410" fill="url(#r1)"/><ellipse cx="1050" cy="615" rx="540" ry="400" fill="url(#r2)"/></g>`);
    if (gradient.type === "pixel") return renderPixelQuilt(stops, opacity, "off");
    return {
      css: `linear-gradient(${gradient.angle}deg in oklab, ${path})`,
      count: 1,
      sizes: ["cover"],
      positions: ["center"]
    };
  }

  function applyRuntimeGradient(theme){
    if (!theme || typeof theme !== "object" || typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root) return;
    const gradient = normalizeGradientConfig(theme);
    const active = gradient.enabled;
    const pageActive = active && gradient.targets.page;
    const panelActive = active && gradient.targets.panels;
    const navbarActive = active && gradient.targets.navbar;
    const staticTheme = staticGradientTheme(theme);
    const page = pageActive ? renderRuntimeSurfaceGradient(staticTheme, 1) : { css: "none", count: 1 };
    const panel = panelActive ? renderRuntimeSurfaceGradient(staticTheme, 0.7) : { css: "none", count: 1 };
    const panelSoft = panelActive ? renderRuntimeSurfaceGradient(staticTheme, 0.42) : { css: "none", count: 1 };
    const navbar = navbarActive ? renderRuntimeSurfaceGradient(staticTheme, 0.78) : { css: "none", count: 1 };
    root.setAttribute("data-btfw-gradient", active ? "on" : "off");
    root.setAttribute("data-btfw-gradient-type", gradient.type);
    root.setAttribute("data-btfw-gradient-page", pageActive ? "on" : "off");
    root.setAttribute("data-btfw-gradient-panels", panelActive ? "on" : "off");
    root.setAttribute("data-btfw-gradient-navbar", navbarActive ? "on" : "off");
    root.setAttribute("data-btfw-gradient-motion", (pageActive || panelActive || navbarActive) ? gradient.motion : "off");
    root.style.setProperty("--btfw-gradient-page-layer", page.css);
    root.style.setProperty("--btfw-gradient-page-runtime-layer", page.css);
    root.style.setProperty("--btfw-gradient-panel-layer", panel.css);
    root.style.setProperty("--btfw-gradient-panel-soft-layer", panelSoft.css);
    root.style.setProperty("--btfw-gradient-panel-runtime-layer", panel.css);
    root.style.setProperty("--btfw-gradient-panel-soft-runtime-layer", panelSoft.css);
    root.style.setProperty("--btfw-gradient-navbar-layer", navbar.css);
    root.style.setProperty("--btfw-gradient-navbar-runtime-layer", navbar.css);
    root.style.setProperty("--btfw-panel-background-size", ["var(--btfw-dither-size)", ...gradientLayerSizes(panel), ...Array(3).fill("auto")].join(", "));
    root.style.setProperty("--btfw-panel-background-position", ["0 0", ...gradientLayerPositions(panel), ...Array(3).fill("center")].join(", "));
    root.style.setProperty("--btfw-page-background-size", ["var(--btfw-dither-size)", ...gradientLayerSizes(page), "auto"].join(", "));
    root.style.setProperty("--btfw-page-background-position", ["0 0", ...gradientLayerPositions(page), "center top"].join(", "));
    root.style.setProperty("--btfw-navbar-gradient-size", gradientLayerSizes(navbar).join(", "));
    root.style.setProperty("--btfw-navbar-gradient-position", gradientLayerPositions(navbar).join(", "));
  }

  function applyRuntimeTypography(theme){
    if (!theme || typeof theme !== "object") return;
    const typography = (theme.typography && typeof theme.typography === "object") ? theme.typography : (theme.typography = {});
    const resolved = applyLiveTypographyAssets(typography, { scope: "runtime" });
    typography.resolvedFamily = resolved.family;
  }

  function applyRuntimePlaylistCatalog(theme){
    if (!theme || typeof theme !== "object" || typeof window === "undefined") return;
    const catalog = theme.playlistCatalog && typeof theme.playlistCatalog === "object"
      ? theme.playlistCatalog
      : { enabled: false, tmdbListUrl: "" };
    catalog.enabled = Boolean(catalog.enabled);
    catalog.tmdbListUrl = typeof catalog.tmdbListUrl === "string" ? catalog.tmdbListUrl.trim() : "";
    theme.playlistCatalog = catalog;
    window.BTFW_CONFIG = window.BTFW_CONFIG || {};
    window.BTFW_CONFIG.playlistCatalog = { enabled: catalog.enabled, tmdbListUrl: catalog.tmdbListUrl };
    try { document.dispatchEvent(new CustomEvent("btfw:playlistCatalogChanged", { detail: window.BTFW_CONFIG.playlistCatalog })); } catch (_) {}
  }

  function syncRuntimeThemeConfig(source){
    if (!source || typeof source !== "object" || typeof window === "undefined") return null;
    const normalized = normalizeConfig(source);
    const global = window.BTFW = window.BTFW || {};
    window.BTFW_THEME_ADMIN = normalized;
    global.channelTheme = normalized;
    applyRuntimeResources(normalized);
    applyRuntimeSlider(normalized);
    applyRuntimeBranding(normalized);
    applyRuntimeColors(normalized);
    applyRuntimeMaterial(normalized);
    applyRuntimeGradient(normalized);
    applyRuntimeIntegrations(normalized);
    applyRuntimeTypography(normalized);
    applyRuntimePlaylistCatalog(normalized);
    applyRuntimeEmotePacks(normalized);
    return normalized;
  }

  // Mirror the owner's emote-pack list onto window.BTFW_CONFIG (where the
  // emote-marketplace loader reads it) and nudge it to reload. Only fires the
  // reload event when the list actually changed, so re-syncs are cheap.
  let _lastEmotePacksJson = null;
  function applyRuntimeEmotePacks(cfg){
    if (typeof window === "undefined") return;
    const packs = Array.isArray(cfg && cfg.emotePacks) ? cfg.emotePacks : [];
    window.BTFW_CONFIG = window.BTFW_CONFIG || {};
    window.BTFW_CONFIG.emotePacks = packs;
    let json = "[]";
    try { json = JSON.stringify(packs); } catch (_) {}
    if (json === _lastEmotePacksJson) return;
    _lastEmotePacksJson = json;
    try {
      document.dispatchEvent(new CustomEvent("btfw:emotePacks:configChanged", { detail: { packs } }));
    } catch (_) {}
  }

  function bootstrapRuntimeThemeSync(){
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const apply = () => {
      try {
        const cfg = window.BTFW_THEME_ADMIN;
        if (cfg && typeof cfg === "object") {
          syncRuntimeThemeConfig(cfg);
        }
      } catch (error) {
        console.warn("[theme-admin] Failed to sync runtime theme config", error);
      }
    };
    apply();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    }
  }

  function injectLocalStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .btfw-theme-admin {
        --btfw-admin-surface: color-mix(in srgb, var(--btfw-theme-panel, #141f36) 92%, transparent 8%);
        --btfw-admin-surface-alt: color-mix(in srgb, var(--btfw-theme-surface, #0b111d) 88%, transparent 12%);
        --btfw-admin-border: color-mix(in srgb, var(--btfw-color-accent) 40%, transparent 60%);
        --btfw-admin-border-soft: color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%);
        --btfw-admin-text: var(--btfw-theme-text, #dce4ff);
        --btfw-admin-text-soft: color-mix(in srgb, var(--btfw-theme-text, #dce4ff) 70%, transparent 30%);
        --btfw-admin-chip: color-mix(in srgb, var(--btfw-color-accent) 28%, transparent 72%);
        padding: 12px 4px 16px;
        color: var(--btfw-admin-text);
        font-family: var(--btfw-font-body, 'Inter', sans-serif);
      }
      .btfw-theme-admin h3 { font-size: 1rem; margin: 0 0 8px; letter-spacing: 0.02em; font-weight: 600; }
      .btfw-theme-admin p.lead { margin: 0 0 12px; color: var(--btfw-admin-text-soft); max-width: 720px; font-size: 0.85rem; }
      .btfw-theme-admin .btfw-filter-status { border: 1px solid var(--btfw-admin-border-soft); border-radius: 10px; padding: 10px 14px; margin: 0 0 12px; background: color-mix(in srgb, var(--btfw-admin-surface-alt) 88%, transparent 12%); display: flex; flex-direction: column; gap: 6px; }
      .btfw-theme-admin .btfw-filter-status__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .btfw-theme-admin .btfw-filter-status__dot { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--btfw-admin-text) 45%, transparent 55%); flex: 0 0 auto; }
      .btfw-theme-admin .btfw-filter-status[data-state="checking"] .btfw-filter-status__dot { background: #e8b53a; animation: btfwFilterStatusPulse 1.1s ease-in-out infinite; }
      .btfw-theme-admin .btfw-filter-status[data-state="ok"] .btfw-filter-status__dot { background: #3ecf8e; }
      .btfw-theme-admin .btfw-filter-status[data-state="outdated"] .btfw-filter-status__dot { background: #e8b53a; }
      @keyframes btfwFilterStatusPulse { 50% { opacity: 0.35; } }
      .btfw-theme-admin .btfw-filter-status__text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
      .btfw-theme-admin .btfw-filter-status__text strong { font-size: 0.76rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--btfw-admin-text); }
      .btfw-theme-admin .btfw-filter-status__text span { font-size: 0.78rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .btfw-filter-status[data-state="outdated"] .btfw-filter-status__text span { color: #e8b53a; }
      .btfw-theme-admin .btfw-filter-status__actions { display: flex; gap: 6px; flex: 0 0 auto; }
      .btfw-theme-admin .btfw-filter-status__btn { border: 1px solid var(--btfw-admin-border-soft); background: color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%); color: var(--btfw-admin-text); border-radius: 8px; padding: 4px 10px; font-size: 0.74rem; cursor: pointer; transition: background 0.18s ease, color 0.18s ease; }
      .btfw-theme-admin .btfw-filter-status__btn:hover { background: color-mix(in srgb, var(--btfw-color-accent) 36%, transparent 64%); }
      .btfw-theme-admin .btfw-filter-status__btn.is-ghost { background: transparent; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .btfw-filter-status__btn.is-ghost:hover { color: var(--btfw-admin-text); }
      .btfw-theme-admin .btfw-filter-status__note { margin: 0; font-size: 0.74rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .btfw-pattern-grid {
        display: flex;
        gap: 8px;
        margin-top: 2px;
        padding: 3px 3px 10px;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-inline: contain;
        scroll-snap-type: x proximity;
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--btfw-color-accent) 52%, transparent)
          color-mix(in srgb, var(--btfw-admin-surface-alt) 72%, transparent);
        cursor: grab;
        touch-action: pan-y;
        user-select: none;
      }
      .btfw-theme-admin .btfw-pattern-grid.is-dragging {
        cursor: grabbing;
        scroll-snap-type: none;
      }
      .btfw-theme-admin .btfw-pattern-grid::-webkit-scrollbar { height: 7px; }
      .btfw-theme-admin .btfw-pattern-grid::-webkit-scrollbar-track {
        border-radius: 999px;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 72%, transparent);
      }
      .btfw-theme-admin .btfw-pattern-grid::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: color-mix(in srgb, var(--btfw-color-accent) 52%, transparent);
      }
      .btfw-theme-admin .btfw-pattern-grid::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--btfw-color-accent) 70%, transparent);
      }
      .btfw-theme-admin .btfw-pattern-tile {
        position: relative;
        flex: 0 0 82px;
        height: 44px;
        scroll-snap-align: start;
        border-radius: 8px;
        border: 1px solid var(--btfw-admin-border-soft);
        background-color: #0d0d0d;
        background-position: center;
        cursor: pointer;
        padding: 0;
        overflow: hidden;
        transition: border-color 150ms ease, box-shadow 150ms ease;
      }
      .btfw-theme-admin .btfw-pattern-tile:hover { border-color: color-mix(in srgb, var(--btfw-color-accent) 45%, transparent); }
      .btfw-theme-admin .btfw-pattern-tile:focus-visible { outline: 2px solid color-mix(in srgb, var(--btfw-color-accent) 65%, transparent); outline-offset: 1px; }
      .btfw-theme-admin .btfw-pattern-tile.is-active {
        border-color: var(--btfw-color-accent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-accent) 35%, transparent);
      }
      .btfw-theme-admin .btfw-pattern-tile--none { display: inline-flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .btfw-pattern-tile__label {
        position: absolute; left: 0; right: 0; bottom: 0;
        padding: 1px 4px;
        font-size: 0.58rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
        color: color-mix(in srgb, var(--btfw-admin-text) 85%, transparent);
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 78%, transparent);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        pointer-events: none;
      }
      .btfw-theme-admin .btfw-backup-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .btfw-theme-admin .btfw-pattern-intensity { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
      .btfw-theme-admin .btfw-pattern-intensity label { font-size: 0.76rem; font-weight: 600; }
      .btfw-theme-admin .btfw-pattern-intensity select { flex: 0 1 160px; }
      .btfw-theme-admin details.section {
        /* The summary and body carry their own padding; the row itself has none.
           (Also guards against host CSS styling the generic .section name.) */
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--btfw-panel-border-soft);
        margin-bottom: 8px;
        background-color: color-mix(in srgb, var(--btfw-admin-surface) 90%, transparent 10%);
        background-image: none;
        background-size: var(--btfw-panel-background-size);
        background-position: var(--btfw-panel-background-position);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-admin-text) 6%, transparent 94%);
        overflow: hidden;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }
      .btfw-theme-admin details.section[open] {
        border-color: var(--btfw-panel-border);
        background-image: none;
        box-shadow: var(--btfw-panel-shadow);
      }
      .btfw-theme-admin summary.section__summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; cursor: pointer; list-style: none; }
      .btfw-theme-admin summary.section__summary::-webkit-details-marker { display: none; }
      .btfw-theme-admin .section__title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .btfw-theme-admin .section__title h4 { margin: 0; font-size: 0.82rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--btfw-admin-text); }
      .btfw-theme-admin .section__title span { font-size: 0.76rem; color: var(--btfw-admin-text-soft); letter-spacing: 0.01em; }
      .btfw-theme-admin .section__chevron { width: 24px; height: 24px; border-radius: 7px; border: 0; background: color-mix(in srgb, var(--btfw-admin-text) 6%, transparent 94%); display: inline-flex; align-items: center; justify-content: center; color: var(--btfw-admin-text-soft); font-size: 1.05rem; line-height: 1; transition: transform 0.2s ease, color 0.18s ease, background 0.18s ease; flex: 0 0 auto; }
      .btfw-theme-admin summary.section__summary:hover .section__chevron { color: var(--btfw-admin-text); background: color-mix(in srgb, var(--btfw-color-accent) 16%, transparent 84%); }
      .btfw-theme-admin details.section[open] .section__chevron { transform: rotate(90deg); color: var(--btfw-admin-text); }
      .btfw-theme-admin .section__body { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
      .btfw-theme-admin .field { display: flex; flex-direction: column; gap: 6px; }
      .btfw-theme-admin label { font-weight: 600; letter-spacing: 0.03em; color: color-mix(in srgb, var(--btfw-admin-text) 92%, transparent 8%); }
      .btfw-theme-admin .btfw-checkbox { display: inline-flex; gap: 10px; align-items: center; font-weight: 600; color: color-mix(in srgb, var(--btfw-admin-text) 92%, transparent 8%); }
      .btfw-theme-admin .btfw-checkbox input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--btfw-color-accent); }
      .btfw-theme-admin .btfw-switch-field { display: flex; flex-direction: column; gap: 6px; }
      /* The pill switch is the visible control; its bound checkbox is a hidden state-holder.
         Host CSS forces a display on every checkbox, overriding the [hidden] attribute,
         so re-assert it here (the visible .btfw-checkbox inputs aren't marked hidden). */
      .btfw-theme-admin input[type="checkbox"][hidden] { display: none !important; }
      .btfw-theme-admin .btfw-switch {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        padding: 10px 14px;
        background-color: color-mix(in srgb, var(--btfw-admin-surface-alt) 82%, transparent);
        background-image: none;
        background-size: var(--btfw-panel-background-size);
        background-position: var(--btfw-panel-background-position);
        border: 1px solid var(--btfw-panel-border-soft);
        border-radius: 12px;
        cursor: pointer;
        color: var(--btfw-admin-text);
        transition: background 160ms ease, border-color 160ms ease;
        font: inherit;
        text-align: left;
        width: 100%;
      }
      .btfw-theme-admin .btfw-switch:hover { border-color: color-mix(in srgb, var(--btfw-color-accent) 35%, var(--btfw-admin-border-soft)); }
      .btfw-theme-admin .btfw-switch[aria-pressed="true"] {
        background-color: color-mix(in srgb, var(--btfw-color-accent) 14%, var(--btfw-admin-surface-alt));
        border-color: color-mix(in srgb, var(--btfw-color-accent) 55%, transparent);
      }
      .btfw-theme-admin .btfw-switch:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--btfw-color-accent) 65%, transparent);
        outline-offset: 2px;
      }
      /* Track/knob chrome comes from the canonical switch recipe in css/ui.css;
         only the pill card and text column are styled here. */
      .btfw-theme-admin .btfw-switch__meta { display: inline-flex; flex-direction: column; gap: 2px; min-width: 0; }
      .btfw-theme-admin .btfw-switch__title { font-weight: 600; font-size: 0.85rem; letter-spacing: 0.02em; color: var(--btfw-admin-text); }
      .btfw-theme-admin .btfw-switch__state {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--btfw-admin-text-soft);
      }
      .btfw-theme-admin .btfw-switch[aria-pressed="true"] .btfw-switch__state {
        color: color-mix(in srgb, var(--btfw-color-accent) 65%, var(--btfw-admin-text));
      }
      .btfw-theme-admin [data-role="movie-info-requirements"] { margin-top: 4px; }
      .btfw-theme-admin .field.is-disabled label,
      .btfw-theme-admin .field.is-disabled .help { opacity: 0.55; }
      .btfw-theme-admin .module-inputs { display: grid; gap: 10px; margin-top: 8px; }
      .btfw-theme-admin .module-input__row { display: flex; }
      .btfw-theme-admin .module-input__control { width: 100%; }
      .btfw-theme-admin input[type="text"],
      .btfw-theme-admin input[type="url"],
      .btfw-theme-admin input[type="datetime-local"],
      .btfw-theme-admin textarea,
      .btfw-theme-admin select {
        width: 100%;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 92%, transparent 8%);
        border: 1px solid var(--btfw-admin-border-soft);
        border-radius: 8px;
        padding: 6px 10px;
        color: color-mix(in srgb, var(--btfw-admin-text) 98%, white 2%);
        font-size: 0.85rem;
        font-family: inherit;
        box-shadow: none;
        transition: border 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      }
      .btfw-theme-admin input[type="text"]:focus,
      .btfw-theme-admin input[type="url"]:focus,
      .btfw-theme-admin input[type="datetime-local"]:focus,
      .btfw-theme-admin textarea:focus,
      .btfw-theme-admin select:focus { border-color: var(--btfw-color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%); outline: none; }
      /* datetime-local ships as a raw UA widget (inset border, grey chrome);
         color-scheme keeps the popup calendar dark, and the indicator icon
         picks up hover affordance instead of the flat default. */
      .btfw-theme-admin input[type="datetime-local"] {
        appearance: none;
        -webkit-appearance: none;
        color-scheme: dark;
        cursor: text;
      }
      .btfw-theme-admin input[type="datetime-local"]::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.65;
        transition: opacity 0.15s ease;
      }
      .btfw-theme-admin input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      .btfw-theme-admin .field.is-disabled input,
      .btfw-theme-admin .field.is-disabled textarea,
      .btfw-theme-admin .field.is-disabled select { opacity: 0.55; }
      .btfw-theme-admin input[type="color"] { width: 100%; height: 32px; padding: 0; border-radius: 8px; border: 1px solid var(--btfw-admin-border-soft); background: var(--btfw-admin-surface-alt); cursor: pointer; }
      .btfw-theme-admin .help { font-size: 0.76rem; color: var(--btfw-admin-text-soft); line-height: 1.4; margin: 0; }
      .btfw-theme-admin .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      /* Palette swatches — one responsive row, each shows the readable hex */
      .btfw-theme-admin .btfw-palette__swatches { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .btfw-theme-admin .btfw-swatch { display: flex; flex-direction: column; gap: 7px; padding: 9px; border-radius: 11px; background-color: var(--btfw-admin-surface); background-image: none; background-size: var(--btfw-panel-background-size); background-position: var(--btfw-panel-background-position); border: 1px solid var(--btfw-panel-border-soft); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-admin-text) 6%, transparent 94%); cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
      .btfw-theme-admin .btfw-swatch:hover { border-color: color-mix(in srgb, var(--btfw-color-accent) 50%, var(--btfw-admin-border-soft)); }
      .btfw-theme-admin .btfw-swatch input[type="color"] { width: 100%; height: 34px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 0; background: none; cursor: pointer; }
      .btfw-theme-admin .btfw-swatch input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      .btfw-theme-admin .btfw-swatch input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 7px; }
      .btfw-theme-admin .btfw-swatch input[type="color"]::-moz-color-swatch { border: 0; border-radius: 7px; }
      .btfw-theme-admin .btfw-swatch__name { font-size: 0.78rem; font-weight: 600; color: var(--btfw-admin-text); letter-spacing: 0.02em; }
      .btfw-theme-admin .btfw-swatch__hex { font-size: 0.7rem; font-family: "JetBrains Mono", monospace; color: var(--btfw-admin-text-soft); text-transform: uppercase; }
      /* Gradient Studio — tactile colour-path controls inspired by dedicated
         gradient tools, but designed to fit the existing channel toolkit. */
      .btfw-theme-admin .btfw-gradient-studio { margin-top: 12px; border: 1px solid var(--btfw-admin-border-soft); border-radius: 13px; overflow: hidden; background: color-mix(in srgb, var(--btfw-admin-surface-alt) 84%, transparent 16%); }
      .btfw-theme-admin .btfw-gradient-studio > .btfw-switch-field { margin: 0; padding: 11px 12px; }
      .btfw-theme-admin .btfw-gradient-editor { padding: 0 12px 14px; border-top: 1px solid var(--btfw-admin-border-soft); }
      .btfw-theme-admin .btfw-gradient-editor[hidden], .btfw-theme-admin [data-role="gradient-angle-field"][hidden] { display: none !important; }
      .btfw-theme-admin .btfw-gradient-lead { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0 8px; }
      .btfw-theme-admin .btfw-gradient-lead .help { max-width: 560px; }
      .btfw-theme-admin .btfw-gradient-reset { flex: 0 0 auto; border: 1px solid var(--btfw-admin-border-soft); border-radius: 8px; padding: 5px 9px; background: transparent; color: var(--btfw-admin-text-soft); font-size: 0.72rem; cursor: pointer; }
      .btfw-theme-admin .btfw-gradient-reset:hover { color: var(--btfw-admin-text); border-color: var(--btfw-color-accent); }

      .btfw-theme-admin .btfw-gradient-type-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 8px 0 11px; }
      .btfw-theme-admin .btfw-gradient-type { display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 7px; min-height: 42px; padding: 5px 7px; border: 1px solid var(--btfw-admin-border-soft); border-radius: 9px; background: color-mix(in srgb, var(--btfw-admin-surface) 88%, transparent); color: var(--btfw-admin-text-soft); cursor: pointer; text-align: left; font-size: 0.69rem; font-weight: 650; transition: border-color 150ms ease, background 150ms ease, color 150ms ease, transform 150ms ease; }
      .btfw-theme-admin .btfw-gradient-type:hover { color: var(--btfw-admin-text); border-color: color-mix(in srgb, var(--btfw-color-accent) 48%, var(--btfw-admin-border-soft)); transform: translateY(-1px); }
      .btfw-theme-admin .btfw-gradient-type[aria-selected="true"] { color: var(--btfw-admin-text); border-color: color-mix(in srgb, var(--btfw-color-accent) 70%, white 6%); background: color-mix(in srgb, var(--btfw-color-accent) 16%, var(--btfw-admin-surface)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--btfw-color-accent) 18%, transparent); }
      .btfw-theme-admin .btfw-gradient-type__preview { width: 32px; height: 28px; border-radius: 6px; background-color: var(--btfw-theme-bg, #05060d); background-image: var(--btfw-gradient-thumb, none); background-size: var(--btfw-gradient-thumb-size, cover); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08); }

      .btfw-theme-admin .btfw-gradient-stage { position: relative; width: 100%; height: auto; aspect-ratio: 5 / 3; margin: 5px 0 13px; border-radius: 12px; overflow: hidden; isolation: isolate; background: var(--btfw-theme-bg, #05060d); border: 1px solid color-mix(in srgb, var(--btfw-admin-text) 16%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 15px 32px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 42%, transparent); }
      .btfw-theme-admin .btfw-gradient-stage__visual { position: absolute; inset: 0; background-color: var(--btfw-theme-bg, #05060d); background-image: none; background-repeat: no-repeat; background-position: center; filter: none; transform: none; }
      .btfw-theme-admin .btfw-gradient-stage::before { content: ""; position: absolute; z-index: 2; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,.1), transparent 32%, rgba(0,0,0,.12)); }
      .btfw-theme-admin .btfw-gradient-stage::after { content: ""; position: absolute; z-index: 3; inset: 0; pointer-events: none; background-image: var(--btfw-gradient-stage-noise, none); background-size: 160px 160px; mix-blend-mode: soft-light; }
      .btfw-theme-admin .btfw-gradient-stage__badge { position: absolute; z-index: 4; left: 10px; top: 9px; padding: 3px 8px; border-radius: 999px; background: rgba(4,6,12,.48); color: rgba(255,255,255,.9); font-size: .64rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; backdrop-filter: blur(8px); }

      .btfw-theme-admin .btfw-gradient-balance-label { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
      .btfw-theme-admin .btfw-gradient-balance-label strong { color: var(--btfw-admin-text); font-size: .75rem; }
      .btfw-theme-admin .btfw-gradient-balance { position: relative; height: 38px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--btfw-admin-text) 16%, transparent); background: var(--btfw-gradient-balance-fill, none); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 8px 18px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 28%, transparent); touch-action: none; cursor: crosshair; transform-origin: center; transition: box-shadow 150ms ease-out, filter 150ms ease-out, transform 250ms cubic-bezier(.22,1,.36,1); }
      .btfw-theme-admin .btfw-gradient-balance::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,.13), transparent 45%, rgba(0,0,0,.12)); }
      .btfw-theme-admin .btfw-gradient-balance__active { position: absolute; z-index: 1; top: 2px; bottom: 2px; border: 2px solid rgba(255,255,255,.88); border-radius: 999px; pointer-events: none; box-shadow: 0 0 0 1px rgba(0,0,0,.2), 0 3px 12px rgba(0,0,0,.22); transition: left 150ms ease-out, width 150ms ease-out, box-shadow 150ms ease-out; }
      .btfw-theme-admin .btfw-gradient-balance__handle { position: absolute; z-index: 4; top: 50%; width: 24px; height: 34px; margin: -17px 0 0 -12px; border: 0; padding: 0; background: transparent; cursor: ew-resize; touch-action: none; }
      .btfw-theme-admin .btfw-gradient-balance__handle::before { content: ""; position: absolute; left: 10px; top: 8px; width: 4px; height: 18px; border-radius: 999px; background: white; box-shadow: 0 1px 4px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.12); transition: transform 150ms ease-out, box-shadow 150ms ease-out; }
      .btfw-theme-admin .btfw-gradient-balance__handle:focus-visible { outline: 2px solid white; outline-offset: 1px; border-radius: 8px; }
      .btfw-theme-admin .btfw-gradient-balance-hint { margin: 6px 2px 11px; color: var(--btfw-admin-text-soft); font-size: .68rem; }
      .btfw-theme-admin .btfw-gradient-balance:hover,
      .btfw-theme-admin .btfw-gradient-balance:focus-within { filter: brightness(1.04); box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 0 0 3px color-mix(in srgb, var(--btfw-theme-accent, #7aa2f7) 20%, transparent), 0 10px 22px color-mix(in srgb, var(--btfw-theme-bg, #05060d) 32%, transparent); }
      .btfw-theme-admin .btfw-gradient-balance.is-dragging { transform: scaleY(.97); transition-duration: 80ms; }
      .btfw-theme-admin .btfw-gradient-balance.is-dragging .btfw-gradient-balance__active { box-shadow: 0 0 0 1px rgba(0,0,0,.24), 0 4px 16px rgba(0,0,0,.28); transition: none; }
      .btfw-theme-admin .btfw-gradient-balance.is-dragging .btfw-gradient-balance__handle::before { transform: scaleY(1.12); box-shadow: 0 1px 5px rgba(0,0,0,.62), 0 0 0 1px rgba(0,0,0,.14); }
      @media (prefers-reduced-motion: reduce) { .btfw-theme-admin .btfw-gradient-balance, .btfw-theme-admin .btfw-gradient-balance__active, .btfw-theme-admin .btfw-gradient-balance__handle::before { transition: none; } .btfw-theme-admin .btfw-gradient-balance.is-dragging { transform: none; } }
      html[data-btfw-motion="reduced"] .btfw-theme-admin .btfw-gradient-balance, html[data-btfw-motion="reduced"] .btfw-theme-admin .btfw-gradient-balance__active, html[data-btfw-motion="reduced"] .btfw-theme-admin .btfw-gradient-balance__handle::before { transition: none; }

      .btfw-theme-admin .btfw-gradient-stops { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .btfw-theme-admin .btfw-gradient-stop { display: grid; grid-template-columns: 32px minmax(0, 1fr); grid-template-areas: "color title" "color meta"; column-gap: 8px; align-items: center; min-width: 0; padding: 8px; border-radius: 9px; border: 1px solid var(--btfw-admin-border-soft); background: color-mix(in srgb, var(--btfw-admin-surface) 88%, transparent); cursor: pointer; transition: border-color 150ms ease, background 150ms ease; }
      .btfw-theme-admin .btfw-gradient-stop.is-active { border-color: color-mix(in srgb, var(--btfw-color-accent) 66%, white 5%); background: color-mix(in srgb, var(--btfw-color-accent) 13%, var(--btfw-admin-surface)); }
      .btfw-theme-admin .btfw-gradient-stop input[type="color"] { grid-area: color; width: 32px; height: 38px; }
      .btfw-theme-admin .btfw-gradient-stop input[type="color"]:disabled { opacity: 1; cursor: default; }
      .btfw-theme-admin .btfw-gradient-stop__title { grid-area: title; min-width: 0; font-size: .68rem; color: var(--btfw-admin-text); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .btfw-theme-admin .btfw-gradient-stop__meta { grid-area: meta; color: var(--btfw-admin-text-soft); font-size: .64rem; }
      .btfw-theme-admin .btfw-gradient-controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-top: 11px; }
      .btfw-theme-admin .btfw-gradient-controls--finish { padding-top: 10px; border-top: 1px solid var(--btfw-admin-border-soft); }
      .btfw-theme-admin .btfw-gradient-controls .field { margin: 0; min-width: 0; }
      .btfw-theme-admin .btfw-gradient-range { display: flex; align-items: center; gap: 8px; }
      .btfw-theme-admin .btfw-gradient-range input { flex: 1 1 auto; min-width: 0; accent-color: var(--btfw-color-accent); }
      .btfw-theme-admin .btfw-gradient-range output { flex: 0 0 38px; text-align: right; font-size: .7rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .btfw-gradient-targets { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
      .btfw-theme-admin .btfw-gradient-target { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 5px 9px; border: 1px solid var(--btfw-admin-border-soft); border-radius: 999px; background: color-mix(in srgb, var(--btfw-admin-surface) 88%, transparent); color: var(--btfw-admin-text-soft); font-size: .72rem; cursor: pointer; }
      .btfw-theme-admin .btfw-gradient-target:has(input:checked) { color: var(--btfw-admin-text); border-color: color-mix(in srgb, var(--btfw-color-accent) 58%, transparent); background: color-mix(in srgb, var(--btfw-color-accent) 17%, var(--btfw-admin-surface)); }
      .btfw-theme-admin .btfw-gradient-target input { margin: 0; accent-color: var(--btfw-color-accent); }
      @media (prefers-reduced-motion: reduce) { .btfw-theme-admin .btfw-gradient-stage__visual { animation: none !important; } }
      @media (max-width: 760px) { .btfw-theme-admin .btfw-gradient-type-grid, .btfw-theme-admin .btfw-gradient-stops { grid-template-columns: repeat(2, minmax(0, 1fr)); } .btfw-theme-admin .btfw-gradient-controls { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 500px) { .btfw-theme-admin .btfw-gradient-controls { grid-template-columns: 1fr; } .btfw-theme-admin .btfw-gradient-lead { align-items: flex-start; } }
      /* Live preview — a real mini-mockup that renders the colors in context */
      .btfw-theme-admin .preview.btfw-tp {
        --btfw-tp-dither-image: none;
        --btfw-tp-dither-size: auto;
        --btfw-tp-gradient-panel: none;
        --btfw-tp-gradient-soft: none;
        --btfw-tp-gradient-navbar: none;
        --btfw-tp-panel-background-size: var(--btfw-tp-dither-size), auto, auto, auto, auto;
        --btfw-tp-soft-background-size: var(--btfw-tp-dither-size), auto, auto, auto;
        --btfw-tp-panel-gradient: var(--btfw-tp-dither-image), var(--btfw-tp-gradient-panel),
          linear-gradient(135deg, color-mix(in srgb, var(--text, #e8ecf7) 6%, transparent), transparent 40%),
          radial-gradient(110% 100% at 0% 0%, color-mix(in srgb, var(--accent, #6d4df6) 18%, transparent), transparent 62%),
          linear-gradient(145deg, color-mix(in srgb, var(--panel, #141f36) 84%, var(--accent, #6d4df6) 16%), color-mix(in srgb, var(--surface, #0b111d) 94%, var(--accent, #6d4df6) 6%));
        --btfw-tp-surface-gradient: var(--btfw-tp-dither-image), var(--btfw-tp-gradient-soft),
          linear-gradient(135deg, color-mix(in srgb, var(--text, #e8ecf7) 4%, transparent), transparent 44%),
          linear-gradient(145deg, color-mix(in srgb, var(--surface, #0b111d) 90%, var(--accent, #6d4df6) 10%), color-mix(in srgb, var(--bg, #05060d) 95%, var(--accent, #6d4df6) 5%));
        --btfw-tp-border: color-mix(in srgb, var(--accent, #6d4df6) 36%, var(--panel, #141f36) 64%);
        display: block; padding: 0; border-radius: 12px; overflow: hidden;
        border: 1px solid var(--btfw-tp-border);
        background: var(--bg, #05060d); grid-template-columns: none;
        box-shadow: 0 18px 40px color-mix(in srgb, var(--bg, #05060d) 48%, transparent),
          0 5px 18px color-mix(in srgb, var(--accent, #6d4df6) 14%, transparent);
      }
      .btfw-theme-admin .preview.btfw-tp[data-dither="subtle"] {
        --btfw-tp-dither-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent, #6d4df6) 16%, transparent) 0 0.65px, transparent 0.8px);
        --btfw-tp-dither-size: 4.5px 4.5px;
      }
      .btfw-theme-admin .preview.btfw-tp[data-dither="medium"] {
        --btfw-tp-dither-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent, #6d4df6) 24%, transparent) 0 0.82px, transparent 0.98px);
        --btfw-tp-dither-size: 4px 4px;
      }
      .btfw-theme-admin .preview.btfw-tp[data-dither="bold"] {
        --btfw-tp-dither-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent, #6d4df6) 36%, transparent) 0 1px, transparent 1.15px);
        --btfw-tp-dither-size: 3.5px 3.5px;
      }
      @supports (color: color-mix(in oklch, red, blue)) {
        .btfw-theme-admin .preview.btfw-tp {
          --btfw-tp-panel-gradient: var(--btfw-tp-dither-image), var(--btfw-tp-gradient-panel),
            linear-gradient(135deg, color-mix(in oklch, var(--text, #e8ecf7) 6%, transparent), transparent 40%),
            radial-gradient(110% 100% at 0% 0%, color-mix(in oklch, var(--accent, #6d4df6) 18%, transparent), transparent 62%),
            linear-gradient(145deg, color-mix(in oklch, var(--panel, #141f36) 84%, var(--accent, #6d4df6) 16%), color-mix(in oklch, var(--surface, #0b111d) 94%, var(--accent, #6d4df6) 6%));
          --btfw-tp-surface-gradient: var(--btfw-tp-dither-image), var(--btfw-tp-gradient-soft),
            linear-gradient(135deg, color-mix(in oklch, var(--text, #e8ecf7) 4%, transparent), transparent 44%),
            linear-gradient(145deg, color-mix(in oklch, var(--surface, #0b111d) 90%, var(--accent, #6d4df6) 10%), color-mix(in oklch, var(--bg, #05060d) 95%, var(--accent, #6d4df6) 5%));
          --btfw-tp-border: color-mix(in oklch, var(--accent, #6d4df6) 36%, var(--panel, #141f36) 64%);
        }
      }
      .btfw-theme-admin .btfw-tp__bar { display: flex; align-items: center; gap: 6px; padding: 9px 13px; background-color: var(--surface, #0b111d); background-image: var(--btfw-tp-gradient-navbar), var(--btfw-tp-surface-gradient); background-size: var(--btfw-tp-navbar-background-size, auto); background-position: var(--btfw-tp-navbar-background-position, center); border-bottom: 1px solid color-mix(in srgb, var(--accent, #6d4df6) 20%, transparent); }
      .btfw-theme-admin .btfw-tp__dot { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--text, #fff) 28%, transparent); }
      .btfw-theme-admin .btfw-tp__barlabel { margin-left: 7px; font-size: 0.72rem; color: color-mix(in srgb, var(--text, #fff) 62%, transparent); letter-spacing: 0.05em; text-transform: uppercase; }
      .btfw-theme-admin .btfw-tp__body { display: grid; grid-template-columns: 1.05fr 1fr; gap: 12px; padding: 14px; background: var(--bg, #05060d); }
      .btfw-theme-admin .btfw-tp__panel { background-color: var(--panel, #141f36); background-image: var(--btfw-tp-panel-gradient); background-size: var(--btfw-tp-panel-background-size); background-position: var(--btfw-tp-panel-background-position, center); border: 1px solid var(--btfw-tp-border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 7px; box-shadow: 0 12px 28px color-mix(in srgb, var(--bg, #05060d) 42%, transparent), inset 0 1px 0 color-mix(in srgb, var(--text, #e8ecf7) 8%, transparent); }
      .btfw-theme-admin .btfw-tp__heading { font-size: 0.95rem; font-weight: 700; color: var(--text, #e8ecf7); }
      .btfw-theme-admin .btfw-tp__sub { font-size: 0.77rem; line-height: 1.5; color: color-mix(in srgb, var(--text, #e8ecf7) 75%, transparent); }
      .btfw-theme-admin .btfw-tp__btn { align-self: flex-start; margin-top: 5px; padding: 7px 16px; border: 0; border-radius: 8px; background-color: var(--accent, #6d4df6); background-image: var(--btfw-tp-dither-image); background-size: var(--btfw-tp-dither-size); color: var(--on-accent, #fff); font-weight: 600; font-size: 0.8rem; cursor: default; }
      .btfw-theme-admin .btfw-tp__chat { background-color: var(--surface, #0b111d); background-image: var(--btfw-tp-surface-gradient); background-size: var(--btfw-tp-soft-background-size); background-position: var(--btfw-tp-soft-background-position, center); border: 1px solid color-mix(in srgb, var(--accent, #6d4df6) 24%, var(--surface, #0b111d) 76%); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 9px; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text, #e8ecf7) 6%, transparent); }
      .btfw-theme-admin .btfw-tp__msg { font-size: 0.79rem; line-height: 1.45; color: var(--chat, #cfd6e6); }
      .btfw-theme-admin .btfw-tp__user { color: var(--accent, #6d4df6); font-weight: 700; margin-right: 5px; }
      @media (max-width: 600px){ .btfw-theme-admin .btfw-tp__body { grid-template-columns: 1fr; } }
      .btfw-theme-admin .preview--font { padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--btfw-admin-surface) 94%, transparent 6%); border: 1px solid var(--btfw-admin-border-soft); display: flex; flex-direction: column; gap: 4px; }
      .btfw-theme-admin .preview__font-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .preview__font-text { font-size: 0.92rem; color: var(--btfw-admin-text); }
      /* ---- Dashboard layout: nav rail + one visible pane ---- */
      .btfw-theme-admin .btfw-admin-layout {
        display: grid;
        grid-template-columns: 198px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
        margin-top: 4px;
      }
      /* Static (not sticky): a sticky rail's tail would sit permanently
         behind the sticky action footer on shorter viewports. */
      .btfw-theme-admin .btfw-admin-nav {
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        border-radius: 12px;
        border: 1px solid var(--btfw-panel-border-soft);
        background-color: color-mix(in srgb, var(--btfw-admin-surface-alt) 72%, transparent 28%);
        background-image: none;
        background-size: var(--btfw-panel-background-size);
        background-position: var(--btfw-panel-background-position);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--btfw-admin-text) 5%, transparent 95%);
      }
      .btfw-theme-admin .btfw-admin-nav__item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px 11px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--btfw-admin-text-soft);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-align: left;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease;
      }
      .btfw-theme-admin .btfw-admin-nav__item i {
        width: 16px;
        text-align: center;
        font-size: 13px;
        opacity: 0.75;
        flex: 0 0 auto;
      }
      .btfw-theme-admin .btfw-admin-nav__item span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .btfw-theme-admin .btfw-admin-nav__item:hover {
        background: color-mix(in srgb, var(--btfw-admin-text) 7%, transparent 93%);
        color: var(--btfw-admin-text);
      }
      .btfw-theme-admin .btfw-admin-nav__item:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 65%, transparent);
        outline-offset: 1px;
      }
      .btfw-theme-admin .btfw-admin-nav__item.is-active {
        background: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 20%, transparent 80%);
        color: var(--btfw-admin-text);
      }
      .btfw-theme-admin .btfw-admin-nav__item.is-active i {
        opacity: 1;
        color: color-mix(in srgb, var(--btfw-theme-accent, #6d4df6) 80%, var(--btfw-admin-text) 20%);
      }
      /* Panes: only the active section shows; its summary is a static header. */
      .btfw-theme-admin .btfw-admin-panes { min-width: 0; }
      .btfw-theme-admin .btfw-admin-panes > details.section { display: none; margin-bottom: 0; }
      .btfw-theme-admin .btfw-admin-panes > details.section.is-active-pane { display: block; }
      .btfw-theme-admin .btfw-admin-panes summary.section__summary {
        pointer-events: none;
        cursor: default;
        padding: 16px 18px 6px;
      }
      .btfw-theme-admin .btfw-admin-panes .section__chevron { display: none; }
      .btfw-theme-admin .btfw-admin-panes .section__title h4 {
        font-size: 0.98rem;
        letter-spacing: 0.01em;
        text-transform: none;
      }
      .btfw-theme-admin .btfw-admin-panes .section__title span { font-size: 0.78rem; }
      .btfw-theme-admin .btfw-admin-panes .section__body { padding: 10px 18px 18px; }
      @media (max-width: 768px) {
        .btfw-theme-admin .btfw-admin-layout { grid-template-columns: 1fr; gap: 10px; }
        .btfw-theme-admin .btfw-admin-nav {
          position: static;
          flex-direction: row;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 4px;
        }
        .btfw-theme-admin .btfw-admin-nav::-webkit-scrollbar { display: none; }
        .btfw-theme-admin .btfw-admin-nav__item { width: auto; flex: 0 0 auto; padding: 8px 12px; }
      }

      /* The action bar is relocated into the modal's own footer (next to
         Close) after wiring, so Apply sits at the true bottom of the modal
         and scrolling content can never leak beneath it. These rules style
         it in BOTH homes; the fallback inside the panel is a plain row. */
      .btfw-theme-admin .buttons { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
      .btfw-admin-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; flex: 1 1 auto; min-width: 0; }
      .modal-footer .btfw-admin-actions { display: none; margin: 0; }
      .modal-footer .btfw-admin-actions.is-visible { display: flex; }
      .modal-footer .btfw-admin-actions .btn-primary,
      .modal-footer .btfw-admin-actions .btn-secondary { padding: 6px 14px; border-radius: 8px; border: 0; font-weight: 600; letter-spacing: 0.01em; cursor: pointer; font-size: 0.85rem; transition: filter 0.16s ease, border-color 0.18s ease; }
      .modal-footer .btfw-admin-actions .btn-primary { background: var(--btfw-color-accent); color: color-mix(in srgb, var(--btfw-theme-text, #dce4ff) 98%, white 2%); }
      .modal-footer .btfw-admin-actions .btn-secondary { background: color-mix(in srgb, var(--btfw-color-panel) 90%, transparent 10%); color: var(--btfw-theme-text, #dce4ff); border: 1px solid color-mix(in srgb, var(--btfw-color-accent) 22%, transparent 78%); }
      .modal-footer .btfw-admin-actions .btn-primary:hover,
      .modal-footer .btfw-admin-actions .btn-secondary:hover { filter: brightness(1.08); }
      .modal-footer .btfw-admin-actions .status { margin-left: auto; font-size: 0.78rem; color: color-mix(in srgb, var(--btfw-theme-text, #dce4ff) 70%, transparent 30%); text-align: right; }
      #channeloptions .modal-footer:has(.btfw-admin-actions) { display: flex; align-items: center; gap: 10px; }
      .btfw-theme-admin .buttons .btn-primary,
      .btfw-theme-admin .buttons .btn-secondary { padding: 6px 14px; border-radius: 8px; border: 0; font-weight: 600; letter-spacing: 0.01em; cursor: pointer; font-size: 0.85rem; transition: filter 0.16s ease, border-color 0.18s ease; }
      .btfw-theme-admin .buttons .btn-primary { background: var(--btfw-color-accent); color: color-mix(in srgb, var(--btfw-admin-text) 98%, white 2%); }
      .btfw-theme-admin .buttons .btn-secondary { background: color-mix(in srgb, var(--btfw-admin-surface-alt) 90%, transparent 10%); color: var(--btfw-admin-text); border: 1px solid var(--btfw-admin-border-soft); }
      .btfw-theme-admin .buttons .btn-primary:hover,
      .btfw-theme-admin .buttons .btn-secondary:hover { filter: brightness(1.08); }
      .btfw-theme-admin .buttons .btn-secondary:hover { border-color: var(--btfw-admin-border); }
      .btfw-theme-admin .status { font-size: 0.78rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .integrations-callout { padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--btfw-admin-surface-alt) 92%, transparent 8%); border: 1px dashed var(--btfw-admin-border-soft); display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; color: var(--btfw-admin-text-soft); }
      .btfw-theme-admin .integrations-callout strong { color: var(--btfw-admin-text); font-size: 0.82rem; }

      /* API-key test row: input grows, button stays content-sized; result
         line below picks up success/error tone. */
      .btfw-theme-admin .key-test-row { display: flex; gap: 8px; align-items: stretch; }
      .btfw-theme-admin .key-test-row input { flex: 1 1 auto; }
      .btfw-theme-admin .key-test-row select { flex: 1 1 auto; min-width: 0; }
      .btfw-theme-admin .key-test-row button { flex: 0 0 auto; }
      .btfw-theme-admin .btfw-control-hidden { display: none !important; }
      .btfw-theme-admin .key-test-row button.is-loading { display: inline-flex; align-items: center; gap: 7px; }
      .btfw-theme-admin .btfw-inline-spinner { display: none; width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: btfw-inline-spin .7s linear infinite; }
      .btfw-theme-admin .key-test-row button.is-loading .btfw-inline-spinner { display: inline-block; }
      .btfw-theme-admin #btfw-playlist-catalog-status { align-items: center; gap: 7px; }
      .btfw-theme-admin #btfw-playlist-catalog-status[data-variant="pending"] { display: flex; }
      .btfw-theme-admin #btfw-playlist-catalog-status[data-variant="pending"] .btfw-status-spinner { display: inline-block; flex: 0 0 auto; }
      @keyframes btfw-inline-spin { to { transform: rotate(360deg); } }
      .btfw-theme-admin .help.is-success { color: color-mix(in srgb, #4ade80 78%, var(--btfw-admin-text) 22%); }
      .btfw-theme-admin .help.is-error   { color: color-mix(in srgb, #ff6f96 78%, var(--btfw-admin-text) 22%); }
      .btfw-theme-admin .help.is-pending { color: var(--btfw-admin-text-soft); font-style: italic; }
      .btfw-theme-admin label { font-weight: 600; letter-spacing: 0.01em; font-size: 0.82rem; color: color-mix(in srgb, var(--btfw-admin-text) 92%, transparent 8%); }

      /* --- Emote Marketplace --- */
      .btfw-theme-admin .btfw-emote-mkt { display: flex; flex-direction: column; gap: 14px; }
      .btfw-theme-admin .btfw-emote-mkt__form {
        padding: 12px; border-radius: 10px;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 92%, transparent 8%);
        border: 1px solid var(--btfw-admin-border-soft);
        display: flex; flex-direction: column; gap: 10px;
      }
      .btfw-theme-admin .btfw-emote-mkt__form .field { min-width: 0; }
      .btfw-theme-admin .btfw-emote-mkt__form select,
      .btfw-theme-admin .btfw-emote-mkt__form input[type="text"] {
        box-sizing: border-box; width: 100%; max-width: 100%; display: block;
        padding: 8px 10px; border-radius: 8px;
        background: var(--btfw-admin-surface); color: var(--btfw-admin-text);
        border: 1px solid var(--btfw-admin-border-soft); font-size: 0.85rem;
      }
      .btfw-theme-admin .btfw-emote-mkt__form select:focus,
      .btfw-theme-admin .btfw-emote-mkt__form input[type="text"]:focus {
        outline: none; border-color: var(--btfw-admin-border);
      }

      /* Dedicated marketplace buttons. We avoid .btn-primary/.btn-secondary on
         purpose: an injected ".modal .btn-primary { … !important }" rule forces
         a washed-out translucent accent fill that we can't override without
         these custom classes. */
      .btfw-theme-admin .btfw-emote-mkt__actions-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .btfw-theme-admin .btfw-mkt-btn {
        box-sizing: border-box; padding: 8px 16px; border-radius: 8px;
        font-weight: 600; font-size: 0.82rem; letter-spacing: 0.01em; line-height: 1.2;
        cursor: pointer; border: 1px solid var(--btfw-admin-border-soft);
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 90%, transparent 10%);
        color: var(--btfw-admin-text);
        transition: filter 0.16s ease, border-color 0.18s ease, background 0.16s ease;
      }
      .btfw-theme-admin .btfw-mkt-btn:hover { border-color: var(--btfw-admin-border); filter: brightness(1.1); }
      .btfw-theme-admin .btfw-mkt-btn:disabled { opacity: 0.55; cursor: default; filter: none; }
      .btfw-theme-admin .btfw-mkt-btn--primary {
        background: color-mix(in srgb, var(--btfw-color-accent) 26%, var(--btfw-admin-surface) 74%);
        border-color: color-mix(in srgb, var(--btfw-color-accent) 60%, transparent);
        color: var(--btfw-admin-text);
      }
      .btfw-theme-admin .btfw-mkt-btn--primary:hover {
        background: color-mix(in srgb, var(--btfw-color-accent) 40%, var(--btfw-admin-surface) 60%);
        border-color: var(--btfw-color-accent); filter: none;
      }

      /* Emote preview grid (shown after Preview / before Add) */
      .btfw-theme-admin .btfw-emote-mkt__preview {
        border-radius: 9px; padding: 10px;
        background: color-mix(in srgb, var(--btfw-admin-surface) 92%, transparent 8%);
        border: 1px solid var(--btfw-admin-border-soft);
      }
      .btfw-theme-admin .btfw-emote-mkt__preview-head { font-size: 0.78rem; font-weight: 600; margin-bottom: 8px; color: var(--btfw-admin-text); }
      .btfw-theme-admin .btfw-emote-mkt__preview-grid { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .btfw-theme-admin .btfw-emote-mkt__preview-grid img {
        width: 30px; height: 30px; object-fit: contain; border-radius: 5px;
        background: color-mix(in srgb, var(--btfw-admin-surface-alt) 70%, transparent 30%); padding: 2px;
      }
      .btfw-theme-admin .btfw-emote-mkt__preview-more { font-size: 0.74rem; color: var(--btfw-admin-text-soft); padding: 0 4px; }

      /* Inline rename input inside a saved pack row */
      .btfw-theme-admin .btfw-emote-pack__rename-input {
        box-sizing: border-box; width: 100%; max-width: 220px; font-size: 0.85rem; font-weight: 600;
        padding: 3px 7px; border-radius: 6px; color: var(--btfw-admin-text);
        background: var(--btfw-admin-surface); border: 1px solid var(--btfw-admin-border);
      }
      .btfw-theme-admin .btfw-emote-pack__rename-input:focus { outline: none; border-color: var(--btfw-color-accent); }
      .btfw-theme-admin .btfw-emote-mkt__list { display: flex; flex-direction: column; gap: 8px; }
      .btfw-theme-admin .btfw-emote-mkt__empty { margin: 0; font-style: italic; }
      .btfw-theme-admin .btfw-emote-pack {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; border-radius: 9px;
        background: color-mix(in srgb, var(--btfw-admin-surface) 90%, transparent 10%);
        border: 1px solid var(--btfw-admin-border-soft);
        transition: opacity 0.15s ease, border-color 0.15s ease;
      }
      .btfw-theme-admin .btfw-emote-pack.is-disabled { opacity: 0.5; }
      .btfw-theme-admin .btfw-emote-pack__badge {
        flex: 0 0 auto; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em;
        padding: 4px 7px; border-radius: 6px; color: var(--btfw-color-on-accent, #fff);
        background: var(--btfw-color-accent);
      }
      .btfw-theme-admin .btfw-emote-pack__badge[data-provider="bttv"] { background: #d50014; }
      .btfw-theme-admin .btfw-emote-pack__badge[data-provider="ffz"]  { background: #33559b; }
      .btfw-theme-admin .btfw-emote-pack__badge[data-provider="egg"]  { background: #5865f2; }
      .btfw-theme-admin .btfw-emote-pack__info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .btfw-theme-admin .btfw-emote-pack__label { font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .btfw-theme-admin .btfw-emote-pack__meta { font-size: 0.72rem; color: var(--btfw-admin-text-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .btfw-theme-admin .btfw-emote-pack__meta code { font-size: 0.7rem; padding: 0 3px; }
      .btfw-theme-admin .btfw-emote-pack__actions { flex: 0 0 auto; display: flex; gap: 6px; }
      .btfw-theme-admin .btfw-emote-pack__btn {
        font-size: 0.72rem; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
        background: var(--btfw-admin-surface-alt); color: var(--btfw-admin-text);
        border: 1px solid var(--btfw-admin-border-soft); transition: filter 0.15s ease, border-color 0.15s ease;
      }
      .btfw-theme-admin .btfw-emote-pack__btn:hover { border-color: var(--btfw-admin-border); filter: brightness(1.1); }
      .btfw-theme-admin .btfw-emote-pack__btn.is-danger:hover { color: #ff6f96; border-color: #ff6f96; }
      @media (max-width: 720px) {
        .btfw-theme-admin { padding: 8px 4px 16px; }
        .btfw-theme-admin summary.section__summary { padding: 10px 12px; }
        .btfw-theme-admin .section__body { padding: 4px 12px 12px; }
        .btfw-theme-admin .grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeFontId(id){
    if (!id) return FONT_DEFAULT_ID;
    const str = String(id).trim().toLowerCase();
    if (str === "custom") return "custom";
    return str.replace(/[^a-z0-9]+/g, "");
  }

  function getFontPreset(id){
    const key = normalizeFontId(id);
    if (key === "custom") return null;
    return FONT_PRESETS[key] || null;
  }

  function buildPresetFontUrl(preset, weights = null){
    if (!preset || !preset.google) return "";

    const weightQuery = weights
      ? (Array.isArray(weights) ? weights.join(";") : weights)
      : CRITICAL_FONT_WEIGHTS.join(";");

    return `https://fonts.googleapis.com/css2?family=${preset.google.replace(/wght@[^&]+/, `wght@${weightQuery}`)}&display=swap`;
  }

  function buildGoogleFontUrl(name, weights = null){
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    const encoded = trimmed.replace(/\s+/g, "+");
    const weightQuery = weights
      ? (Array.isArray(weights) ? weights.join(";") : weights)
      : CRITICAL_FONT_WEIGHTS.join(";");

    return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weightQuery}&display=swap`;
  }

  function resolveTypographyConfig(typo){
    const presetId = normalizeFontId(typo?.preset || FONT_DEFAULT_ID);
    const isCustom = presetId === "custom";
    const preset = getFontPreset(presetId) || getFontPreset(FONT_DEFAULT_ID);
    const customName = (typo?.customFamily || "").trim();
    const family = isCustom && customName
      ? `'${customName.replace(/'/g, "\\'")}', ${FONT_FALLBACK_FAMILY}`
      : (preset?.family || FONT_FALLBACK_FAMILY);
    let url = preset?.google
      ? `https://fonts.googleapis.com/css2?family=${preset.google}&display=swap`
      : "";
    if (isCustom && customName) {
      url = buildGoogleFontUrl(customName);
    }
    return {
      preset: isCustom ? "custom" : (preset ? normalizeFontId(presetId) : FONT_DEFAULT_ID),
      label: isCustom && customName ? customName : (preset?.name || "Inter"),
      family,
      url: url || ""
    };
  }

  function ensureStylesheetLink(id, url){
    if (typeof document === "undefined" || !document.head) return;
    let link = document.getElementById(id);
    if (url) {
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.rel !== "stylesheet") {
        link.rel = "stylesheet";
      }
      if (link.getAttribute("crossorigin") !== "anonymous") {
        link.setAttribute("crossorigin", "anonymous");
      }
      if (link.getAttribute("href") !== url) {
        link.setAttribute("href", url);
      }
    } else if (link && link.parentElement) {
      link.parentElement.removeChild(link);
    }
  }

  function ensureFontPreloadLink(id, url){
    if (typeof document === "undefined" || !document.head) return;
    let link = document.getElementById(id);
    if (url) {
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "preload";
        link.as = "style";
        link.setAttribute("crossorigin", "anonymous");
        document.head.appendChild(link);
      }
      if (link.getAttribute("href") !== url) {
        link.setAttribute("href", url);
      }
    } else if (link && link.parentElement) {
      link.parentElement.removeChild(link);
    }
  }

  function extractPrimaryFontFamily(family){
    if (!family) return "";
    const first = String(family).split(",")[0] || "";
    return first.replace(/['"]/g, "").trim();
  }

  function waitForFontFamilyLoad(name){
    if (!name || typeof document === "undefined") return Promise.resolve(false);
    const fontSet = document.fonts;
    if (!fontSet || typeof fontSet.load !== "function") {
      return Promise.resolve(false);
    }
    if (typeof fontSet.check === "function") {
      try {
        if (fontSet.check(`1rem "${name}"`)) {
          return Promise.resolve(true);
        }
      } catch (_) {}
    }
    const requests = PREVIEW_FONT_WEIGHTS.map(weight => {
      const spec = `${weight} 1rem "${name}"`;
      try {
        return fontSet.load(spec);
      } catch (error) {
        try {
          return fontSet.load(`1rem "${name}"`);
        } catch (_) {
          return Promise.resolve();
        }
      }
    });
    return Promise.all(requests).then(() => true).catch(() => false);
  }

  function ensurePreviewFontStylesheet(url){
    if (typeof document === "undefined" || !document.head) return Promise.resolve(null);
    const existing = document.getElementById(THEME_FONT_PREVIEW_LINK_ID);
    if (!url) {
      if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
      }
      return Promise.resolve(null);
    }
    if (existing && existing.getAttribute("href") === url) {
      if (existing.dataset.btfwLoaded === "1") {
        return Promise.resolve(existing);
      }
      if (previewStylesheetPromises.has(url)) {
        return previewStylesheetPromises.get(url);
      }
      const wait = new Promise(resolve => {
        const finalize = () => resolve(existing);
        existing.addEventListener("load", () => {
          existing.dataset.btfwLoaded = "1";
          finalize();
        }, { once: true });
        existing.addEventListener("error", finalize, { once: true });
      });
      previewStylesheetPromises.set(url, wait);
      return wait.then(result => {
        previewStylesheetPromises.delete(url);
        return result;
      }, error => {
        previewStylesheetPromises.delete(url);
        throw error;
      });
    }
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
    const link = document.createElement("link");
    link.id = THEME_FONT_PREVIEW_LINK_ID;
    link.rel = "stylesheet";
    link.dataset.btfwScope = "preview";
    const promise = new Promise(resolve => {
      const finalize = () => resolve(link);
      link.addEventListener("load", () => {
        link.dataset.btfwLoaded = "1";
        finalize();
      }, { once: true });
      link.addEventListener("error", finalize, { once: true });
    });
    link.href = url;
    document.head.appendChild(link);
    previewStylesheetPromises.set(url, promise);
    return promise.then(result => {
      previewStylesheetPromises.delete(url);
      return result;
    }, error => {
      previewStylesheetPromises.delete(url);
      throw error;
    });
  }

  function ensurePreviewFontAssets(resolved){
    if (!resolved) return;
    const url = resolved.url || "";
    if (!url) {
      return ensurePreviewFontStylesheet("");
    }
    const family = extractPrimaryFontFamily(resolved.family);
    if (!family) {
      return ensurePreviewFontStylesheet(url);
    }
    const cacheKey = `${url}::${family}`;
    if (previewFontLoadCache.has(cacheKey)) {
      return previewFontLoadCache.get(cacheKey);
    }
    const loadPromise = ensurePreviewFontStylesheet(url)
      .then(() => waitForFontFamilyLoad(family))
      .then(result => result, error => {
        console.warn(`[theme-admin] Failed to load preview font "${family}"`, error);
        previewFontLoadCache.delete(cacheKey);
        return false;
      });
    previewFontLoadCache.set(cacheKey, loadPromise);
    return loadPromise;
  }

  function applyLiveTypographyAssets(typography, options = {}){
    const resolved = resolveTypographyConfig(typography);
    const scope = options.scope === "preview" ? "preview" : "runtime";
    const root = options.root || (typeof document !== "undefined" ? document.documentElement : null);
    if (root && resolved.family) {
      root.style.setProperty("--btfw-theme-font-family", resolved.family);
    }
    if (scope === "preview") {
      ensurePreviewFontAssets(resolved);
    } else {
      const fontUrl = resolved.url || "";
      ensureFontPreloadLink(THEME_FONT_PRELOAD_LINK_ID, fontUrl);
      ensureStylesheetLink(THEME_FONT_LINK_ID, fontUrl);
      if (typeof document !== "undefined") {
        const previewLink = document.getElementById(THEME_FONT_PREVIEW_LINK_ID);
        if (previewLink && previewLink.parentElement) {
          previewLink.parentElement.removeChild(previewLink);
        }
      }
    }
    return resolved;
  }

  function cloneDefaults(){
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function overwriteConfig(target, source){
    if (!target || typeof target !== "object") return target;
    Object.keys(target).forEach(key => {
      delete target[key];
    });
    if (!source || typeof source !== "object") return target;
    const copy = JSON.parse(JSON.stringify(source));
    Object.keys(copy).forEach(key => {
      target[key] = copy[key];
    });
    return target;
  }

  function coerceModuleValue(value){
    if (typeof value === "string") {
      return value.trim();
    }
    if (!value || typeof value !== "object") return "";

    if (Array.isArray(value)) {
      if (!value.length) return "";
      return coerceModuleValue(value[0]);
    }

    for (const key of ["url", "href", "src", "value"]) {
      if (typeof value[key] === "string") {
        return value[key].trim();
      }
    }

    return "";
  }

  function collectModuleCandidates(source){
    if (!source || typeof source !== "object") return [];

    const seen = typeof WeakSet === "function" ? new WeakSet() : null;
    const candidates = [];

    const traverse = (value) => {
      if (!value || typeof value !== "object") return;
      if (seen) {
        if (seen.has(value)) return;
        seen.add(value);
      }

      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === "object") {
            traverse(item);
          }
        });
        return;
      }

      Object.keys(value).forEach(key => {
        const child = value[key];
        if (/module/i.test(key)) {
          if (typeof child !== "undefined" && child !== null) {
            candidates.push(child);
          }
        }
        if (child && typeof child === "object") {
          traverse(child);
        }
      });
    };

    traverse(source);
    return candidates;
  }

  function normalizeModuleUrls(values){
    const urls = [];
    const seenObjects = typeof WeakSet === "function" ? new WeakSet() : null;

    const walk = (value) => {
      if (typeof value === "undefined" || value === null) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          urls.push(trimmed);
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(item => walk(item));
        return;
      }
      if (typeof value === "object") {
        if (seenObjects) {
          if (seenObjects.has(value)) return;
          seenObjects.add(value);
        }
        const direct = coerceModuleValue(value);
        if (direct) {
          urls.push(direct);
        }
        const skipKeys = ["url", "href", "src", "value"];
        Object.keys(value).forEach(key => {
          if (direct && skipKeys.includes(key)) return;
          walk(value[key]);
        });
      }
    };

    walk(values);

    const normalized = [];
    const seen = new Set();
    urls.forEach(url => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      normalized.push(url);
    });
    return normalized;
  }

  function getModuleContainer(panel){
    if (!panel) return null;
    return panel.querySelector(MODULE_INPUT_SELECTOR);
  }

  function createModuleInput(index, value){
    const wrapper = document.createElement("div");
    wrapper.className = "module-input__row";
    const input = document.createElement("input");
    input.type = "url";
    input.className = "module-input__control";
    input.id = `btfw-theme-module-${index}`;
    input.name = `btfw-theme-module-${index}`;
    input.placeholder = "https://example.com/module.js";
    input.dataset.role = "module-input";
    input.value = value || "";
    wrapper.appendChild(input);
    return { wrapper, input };
  }

  function appendModuleInput(container, index, value){
    if (!container) return null;
    const { wrapper, input } = createModuleInput(index, value);
    container.appendChild(wrapper);
    return input;
  }

  function renderModuleInputs(panel, values){
    const container = getModuleContainer(panel);
    if (!container) return;
    const normalized = normalizeModuleUrls(values);
    const limited = normalized.slice(0, MODULE_FIELD_MAX);
    const rows = [];
    limited.forEach((value, index) => {
      const { wrapper } = createModuleInput(index, value);
      rows.push(wrapper);
    });
    let count = limited.length;
    while (count < MODULE_FIELD_MIN && count < MODULE_FIELD_MAX) {
      const { wrapper } = createModuleInput(count, "");
      rows.push(wrapper);
      count++;
    }
    const canExtend = count < MODULE_FIELD_MAX && normalized.length === limited.length;
    if (canExtend && count === limited.length) {
      const { wrapper } = createModuleInput(count, "");
      rows.push(wrapper);
    }

    if (typeof container.replaceChildren === "function") {
      container.replaceChildren(...rows);
    } else {
      container.innerHTML = "";
      rows.forEach(row => container.appendChild(row));
    }
  }

  function trimModuleInputs(panel){
    const container = getModuleContainer(panel);
    if (!container) return;
    container.querySelectorAll('.module-input__row').forEach(row => {
      if (!row.querySelector('input[data-role="module-input"]')) {
        row.remove();
      }
    });
    let inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    while (inputs.length > MODULE_FIELD_MIN) {
      const last = inputs[inputs.length - 1];
      if (last && !last.value.trim()) {
        const precedingHasEmpty = inputs.slice(0, inputs.length - 1).some(input => !input.value.trim());
        if (precedingHasEmpty) {
          const wrapper = last.closest('.module-input__row');
          if (wrapper && wrapper.parentElement === container) {
            container.removeChild(wrapper);
          } else {
            last.remove();
          }
          inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
          continue;
        }
      }
      break;
    }
  }

  function ensureModuleFieldAvailability(panel){
    const container = getModuleContainer(panel);
    if (!container) return;
    container.querySelectorAll('.module-input__row').forEach(row => {
      if (!row.querySelector('input[data-role="module-input"]')) {
        row.remove();
      }
    });
    let inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    if (!inputs.length) {
      renderModuleInputs(panel, []);
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    if (inputs.length < MODULE_FIELD_MIN) {
      let index = inputs.length;
      while (index < MODULE_FIELD_MIN && index < MODULE_FIELD_MAX) {
        appendModuleInput(container, index, "");
        index++;
      }
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    const hasEmpty = inputs.some(input => !input.value.trim());
    if (!hasEmpty && inputs.length < MODULE_FIELD_MAX) {
      appendModuleInput(container, inputs.length, "");
      inputs = Array.from(container.querySelectorAll('input[data-role="module-input"]'));
    }
    trimModuleInputs(panel);
  }

  function finalizeModuleWatcher(container, watcher){
    if (watcher.timeoutId !== null) {
      clearTimeout(watcher.timeoutId);
      watcher.timeoutId = null;
    }
    if (watcher.observer) {
      watcher.observer.disconnect();
      watcher.observer = null;
    }
    activeModuleWatchers.delete(watcher);
    if (moduleWatcherRegistry.get(container) === watcher) {
      moduleWatcherRegistry.delete(container);
    }
    if (container) {
      delete container._btfwModuleHandlerBound;
      if (container.dataset && container.dataset.btfwModuleWatcher) {
        delete container.dataset.btfwModuleWatcher;
      }
    }
  }

  function cleanupModuleWatcher(container, expectedWatcher){
    if (!container) return;
    const watcher = moduleWatcherRegistry.get(container);
    if (!watcher || (expectedWatcher && watcher !== expectedWatcher)) {
      return;
    }
    if (!watcher.controller.signal.aborted) {
      watcher.controller.abort();
      return;
    }
    finalizeModuleWatcher(container, watcher);
  }

  if (typeof window !== "undefined" && !window.__btfwModuleWatcherCleanupRegistered) {
    window.addEventListener('beforeunload', () => {
      const watchers = Array.from(activeModuleWatchers);
      for (const watcher of watchers) {
        cleanupModuleWatcher(watcher.container, watcher);
      }
    });
    window.__btfwModuleWatcherCleanupRegistered = true;
  }

  function bindModuleFieldWatcher(panel, onChange){
    const container = getModuleContainer(panel);
    if (!container) {
      console.warn('[theme-admin] Module container not found for binding');
      return;
    }

    cleanupModuleWatcher(container);

    const controller = new AbortController();
    const watcherRecord = {
      container,
      controller,
      timeoutId: null,
      observer: null
    };

    moduleWatcherRegistry.set(container, watcherRecord);
    activeModuleWatchers.add(watcherRecord);

    controller.signal.addEventListener('abort', () => {
      if (moduleWatcherRegistry.get(container) === watcherRecord) {
        finalizeModuleWatcher(container, watcherRecord);
      }
    });

    const handler = (event) => {
      if (event?.target?.dataset?.role === 'module-input') {
        if (watcherRecord.timeoutId !== null) {
          clearTimeout(watcherRecord.timeoutId);
        }
        watcherRecord.timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) {
            ensureModuleFieldAvailability(panel);
            if (typeof onChange === "function") onChange();
          }
          watcherRecord.timeoutId = null;
        }, 10);
      }
    };

    container.addEventListener('input', handler, { signal: controller.signal });
    container.addEventListener('change', handler, { signal: controller.signal });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          const hasContains = typeof node?.contains === 'function';
          if (
            node === panel ||
            node === container ||
            (hasContains && (node.contains(panel) || node.contains(container)))
          ) {
            cleanupModuleWatcher(container, watcherRecord);
            return;
          }
        }
      }
    });

    watcherRecord.observer = observer;
    observer.observe(document.body, { childList: true, subtree: true });

    container._btfwModuleHandlerBound = true;
    if (container.dataset) {
      container.dataset.btfwModuleWatcher = "1";
    }
  }

  function readModuleValues(panel){
    const container = getModuleContainer(panel);
    if (!container) return [];
    const seen = new Set();
    const values = [];
    container.querySelectorAll('input[data-role="module-input"]').forEach(input => {
      const value = (input.value || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      values.push(value);
    });
    return values;
  }

  function deepMerge(target, source){
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(key => {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = deepMerge(target[key] ? { ...target[key] } : {}, value);
      } else {
        target[key] = Array.isArray(value) ? value.slice() : value;
      }
    });
    return target;
  }

  function parseConfig(jsText){
    if (!jsText) return null;
    const start = jsText.indexOf(JS_BLOCK_START);
    const end = jsText.indexOf(JS_BLOCK_END);
    if (start === -1 || end === -1 || end < start) return null;
    const block = jsText.slice(start + JS_BLOCK_START.length, end).trim();
    const match = block.match(/window\.BTFW_THEME_ADMIN\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (err) {
      console.warn("[theme-admin] Failed to parse stored config", err);
      return null;
    }
  }

  function normalizeConfig(cfg){
    const defaults = cloneDefaults();
    const normalized = cloneDefaults();
    deepMerge(normalized, cfg || {});

    if (!normalized.slider || typeof normalized.slider !== "object") {
      normalized.slider = JSON.parse(JSON.stringify(defaults.slider));
    }
    const slider = normalized.slider || {};
    normalized.sliderEnabled = Boolean(slider.enabled);
    normalized.sliderJson = slider.feedUrl || slider.url || normalized.sliderJson || "";

    if (!normalized.material || typeof normalized.material !== "object") {
      normalized.material = JSON.parse(JSON.stringify(defaults.material));
    }
    normalized.material.dither = Boolean(normalized.material.dither);
    if (!DITHER_INTENSITIES.includes(normalized.material.ditherIntensity)) {
      normalized.material.ditherIntensity = "subtle";
    }
    normalizeGradientConfig(normalized);

    if (!normalized.integrations || typeof normalized.integrations !== "object") {
      normalized.integrations = JSON.parse(JSON.stringify(defaults.integrations));
    }
    if (typeof normalized.integrations.enabled !== "boolean") {
      normalized.integrations.enabled = true;
    }
    if (!normalized.integrations.tmdb || typeof normalized.integrations.tmdb !== "object") {
      normalized.integrations.tmdb = { apiKey: "" };
    } else if (typeof normalized.integrations.tmdb.apiKey !== "string") {
      normalized.integrations.tmdb.apiKey = "";
    } else {
      normalized.integrations.tmdb.apiKey = normalized.integrations.tmdb.apiKey.trim();
    }
    if (!normalized.integrations.klipy || typeof normalized.integrations.klipy !== "object") {
      normalized.integrations.klipy = { apiKey: "" };
    } else if (typeof normalized.integrations.klipy.apiKey !== "string") {
      normalized.integrations.klipy.apiKey = "";
    } else {
      normalized.integrations.klipy.apiKey = normalized.integrations.klipy.apiKey.trim();
    }
    if (!normalized.integrations.wyzie || typeof normalized.integrations.wyzie !== "object") {
      normalized.integrations.wyzie = { apiKey: "" };
    } else if (typeof normalized.integrations.wyzie.apiKey !== "string") {
      normalized.integrations.wyzie.apiKey = "";
    } else {
      normalized.integrations.wyzie.apiKey = normalized.integrations.wyzie.apiKey.trim();
    }
    if (!normalized.integrations.subdl || typeof normalized.integrations.subdl !== "object") {
      normalized.integrations.subdl = { apiKey: "" };
    } else if (typeof normalized.integrations.subdl.apiKey !== "string") {
      normalized.integrations.subdl.apiKey = "";
    } else {
      normalized.integrations.subdl.apiKey = normalized.integrations.subdl.apiKey.trim();
    }
    if (!normalized.integrations.ratings || typeof normalized.integrations.ratings !== "object") {
      normalized.integrations.ratings = { endpoint: "" };
    } else if (typeof normalized.integrations.ratings.endpoint !== "string") {
      normalized.integrations.ratings.endpoint = "";
    } else {
      normalized.integrations.ratings.endpoint = normalized.integrations.ratings.endpoint.trim();
    }
    if (!normalized.integrations.movieInfo || typeof normalized.integrations.movieInfo !== "object") {
      normalized.integrations.movieInfo = { enabled: false };
    } else {
      normalized.integrations.movieInfo.enabled = Boolean(normalized.integrations.movieInfo.enabled);
    }
    if (!normalized.integrations.autoSubs || typeof normalized.integrations.autoSubs !== "object") {
      normalized.integrations.autoSubs = { enabled: false };
    } else {
      normalized.integrations.autoSubs.enabled = Boolean(normalized.integrations.autoSubs.enabled);
    }

    if (!normalized.integrations.audioEnhancer || typeof normalized.integrations.audioEnhancer !== "object") {
      normalized.integrations.audioEnhancer = { enabled: false };
    } else {
      normalized.integrations.audioEnhancer.enabled = Boolean(normalized.integrations.audioEnhancer.enabled);
    }

    if (normalized.features && typeof normalized.features === "object") {
      delete normalized.features.videoOverlayPoll;
      if (Object.keys(normalized.features).length === 0) {
        delete normalized.features;
      }
    }

    if (!normalized.resources || typeof normalized.resources !== "object") {
      normalized.resources = JSON.parse(JSON.stringify(defaults.resources));
    }
    if (!Array.isArray(normalized.resources.styles)) {
      normalized.resources.styles = [];
    }
    if (!Array.isArray(normalized.resources.scripts)) {
      normalized.resources.scripts = [];
    }
    const normalizedModules = normalizeModuleUrls(collectModuleCandidates(normalized));
    normalized.resources.modules = normalizedModules;
    delete normalized.resources.moduleUrls;
    delete normalized.resources.externalModules;
    delete normalized.moduleUrls;
    delete normalized.externalModules;
    delete normalized.modules;

    if (!normalized.branding || typeof normalized.branding !== "object") {
      normalized.branding = JSON.parse(JSON.stringify(defaults.branding));
    }
    if (typeof normalized.branding.favicon === "string" && !normalized.branding.faviconUrl) {
      normalized.branding.faviconUrl = normalized.branding.favicon;
    }
    if (typeof normalized.headerName === "string" && !normalized.branding.headerName) {
      normalized.branding.headerName = normalized.headerName;
    }
    if (typeof normalized.branding.header === "string" && !normalized.branding.headerName) {
      normalized.branding.headerName = normalized.branding.header;
    }
    if (typeof normalized.faviconUrl === "string" && !normalized.branding.faviconUrl) {
      normalized.branding.faviconUrl = normalized.faviconUrl;
    }
    if (typeof normalized.posterUrl === "string" && !normalized.branding.posterUrl) {
      normalized.branding.posterUrl = normalized.posterUrl;
    }
    if (typeof normalized.branding.posterUrl !== "string") {
      normalized.branding.posterUrl = "";
    }

    if (!normalized.typography || typeof normalized.typography !== "object") {
      normalized.typography = JSON.parse(JSON.stringify(defaults.typography));
    }

    normalized.emotePacks = normalizeEmotePacks(normalized.emotePacks);

    if (!normalized.moviePoll || typeof normalized.moviePoll !== "object") {
      normalized.moviePoll = { enabled: false };
    } else {
      normalized.moviePoll.enabled = Boolean(normalized.moviePoll.enabled);
    }

    if (!normalized.playlistCatalog || typeof normalized.playlistCatalog !== "object") {
      normalized.playlistCatalog = { enabled: false, tmdbListUrl: "" };
    } else {
      normalized.playlistCatalog.enabled = Boolean(normalized.playlistCatalog.enabled);
      normalized.playlistCatalog.tmdbListUrl = typeof normalized.playlistCatalog.tmdbListUrl === "string"
        ? normalized.playlistCatalog.tmdbListUrl.trim()
        : "";
    }

    return normalized;
  }

  // Emote Marketplace packs -> clean [{provider, id, label, enabled}] array.
  function normalizeEmotePacks(list){
    if (!Array.isArray(list)) return [];
    const allowed = { "7tv": 1, "bttv": 1, "ffz": 1, "egg": 1 };
    const seen = {};
    const out = [];
    list.forEach(p => {
      if (!p || typeof p !== "object") return;
      const provider = String(p.provider || "").trim().toLowerCase();
      const id = String(p.id == null ? "" : p.id).trim();
      if (!allowed[provider] || !id) return;
      const key = provider + ":" + id;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({
        provider,
        id,
        label: typeof p.label === "string" ? p.label.trim() : "",
        enabled: p.enabled !== false
      });
    });
    return out;
  }

  /* ---- Emote Marketplace admin helpers ---- */
  let _emoteMktApi = null;
  function getEmoteMktApi(){
    if (_emoteMktApi) return Promise.resolve(_emoteMktApi);
    try {
      return BTFW.init("feature:emote-marketplace").then(api => { _emoteMktApi = api; return api; });
    } catch (_) {
      return Promise.resolve(null);
    }
  }

  const EMOTE_PROVIDER_META = {
    "7tv":  { name: "7TV",          badge: "7TV" },
    "bttv": { name: "BetterTTV",    badge: "BTTV" },
    "ffz":  { name: "FrankerFaceZ", badge: "FFZ" },
    "egg":  { name: "emoji.gg",     badge: "EGG" }
  };

  // Pull the usable id out of whatever the owner pasted (a provider URL or a
  // bare id). Returns "" when nothing usable is found.
  function parseEmotePackId(provider, raw){
    const s = String(raw || "").trim();
    if (!s) return "";
    if (provider === "7tv") {
      const m = s.match(/emote-sets?\/([A-Za-z0-9]+)/i);
      if (m) return m[1];
      const m2 = s.match(/^([A-Za-z0-9]{16,})$/);
      return m2 ? m2[1] : "";
    }
    if (provider === "bttv") {
      if (/^global$/i.test(s)) return "global";
      const m = s.match(/(\d{2,})/); // a twitch numeric user id
      return m ? m[1] : "";
    }
    if (provider === "ffz") {
      if (/^global$/i.test(s)) return "global";
      // a frankerfacez.com/channel/<name> URL, or a bare channel name / set id
      const ch = s.match(/frankerfacez\.com\/channel\/([A-Za-z0-9_]+)/i);
      if (ch) return ch[1].toLowerCase();
      const m2 = s.match(/^([A-Za-z0-9_]+)$/);
      return m2 ? m2[1].toLowerCase() : "";
    }
    if (provider === "egg") {
      // emoji.gg pack slug from a /pack/<slug> URL, else a raw slug/number.
      const m = s.match(/\/pack\/([A-Za-z0-9][A-Za-z0-9-]*)/i);
      if (m) return m[1];
      const m2 = s.match(/^([A-Za-z0-9][A-Za-z0-9-]*)$/);
      return m2 ? m2[1] : "";
    }
    return s;
  }

  function escAttr(s){ return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Paint the saved-pack list. Each row carries data-key so the delegated
  // click handler (wired once in watchInputs) can act on it.
  function renderEmotePackList(panel, cfg){
    const host = panel.querySelector('[data-role="emote-pack-list"]');
    if (!host) return;
    const packs = Array.isArray(cfg && cfg.emotePacks) ? cfg.emotePacks : [];
    if (!packs.length) {
      host.innerHTML = '<p class="help btfw-emote-mkt__empty">No packs yet. Add one above and it shows up as a tab in the chat emote picker.</p>';
      return;
    }
    const live = (typeof window !== "undefined" && Array.isArray(window.BTFW_EMOTE_PACKS)) ? window.BTFW_EMOTE_PACKS : [];
    host.innerHTML = packs.map((p, i) => {
      const meta = EMOTE_PROVIDER_META[p.provider] || { name: p.provider, badge: p.provider };
      const loaded = live.find(l => l.key === (p.provider + ":" + p.id));
      const count = loaded ? loaded.emotes.length : null;
      const label = (p.label && p.label.trim()) || (loaded && loaded.label) || (p.provider + " " + p.id);
      const enabled = p.enabled !== false;
      const countTxt = count == null ? "loading…" : (count + " emote" + (count === 1 ? "" : "s"));
      return `
        <div class="btfw-emote-pack ${enabled ? '' : 'is-disabled'}" data-key="${escAttr(p.provider + ':' + p.id)}" data-index="${i}">
          <span class="btfw-emote-pack__badge" data-provider="${escAttr(p.provider)}">${escAttr(meta.badge)}</span>
          <span class="btfw-emote-pack__info">
            <span class="btfw-emote-pack__label">${escAttr(label)}</span>
            <span class="btfw-emote-pack__meta">${escAttr(meta.name)} · <code>${escAttr(p.id)}</code> · ${escAttr(countTxt)}</span>
          </span>
          <span class="btfw-emote-pack__actions">
            <button type="button" class="btfw-emote-pack__btn" data-act="rename" title="Rename tab">Rename</button>
            <button type="button" class="btfw-emote-pack__btn" data-act="toggle" title="${enabled ? 'Hide this pack' : 'Show this pack'}">${enabled ? 'On' : 'Off'}</button>
            <button type="button" class="btfw-emote-pack__btn is-danger" data-act="remove" title="Remove this pack">Remove</button>
          </span>
        </div>`;
    }).join("");
  }

  // Render a thumbnail grid preview of a fetched pack into `host`.
  function renderEmotePreview(host, data){
    if (!host) return;
    const emotes = (data && data.emotes) || [];
    const MAX = 48;
    const shown = emotes.slice(0, MAX);
    const more = emotes.length - shown.length;
    host.hidden = false;
    host.innerHTML =
      `<div class="btfw-emote-mkt__preview-head">${escAttr(data && data.name || 'Pack')} · ${emotes.length} emote${emotes.length === 1 ? '' : 's'}</div>` +
      `<div class="btfw-emote-mkt__preview-grid">` +
      shown.map(e => `<img src="${escAttr(e.image)}" alt="" title="${escAttr(e.name || '')}" loading="lazy">`).join("") +
      (more > 0 ? `<span class="btfw-emote-mkt__preview-more">+${more}</span>` : "") +
      `</div>`;
  }

  // Swap a pack row's label for an inline text input so the owner can rename
  // the tab after adding it. Commits on Enter/blur, cancels on Escape.
  function startRenamePack(row, idx, cfg, commit){
    const labelEl = row.querySelector('.btfw-emote-pack__label');
    if (!labelEl || row.querySelector('.btfw-emote-pack__rename-input')) return;
    const current = (cfg.emotePacks[idx] && cfg.emotePacks[idx].label) || "";
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'btfw-emote-pack__rename-input';
    input.value = current;
    input.placeholder = 'Tab name (blank = default)';
    labelEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save && cfg.emotePacks[idx]) cfg.emotePacks[idx].label = input.value.trim();
      commit();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  function sanitizeConfigForOutput(cfg){
    const cleaned = JSON.parse(JSON.stringify(cfg || {}));
    delete cleaned.sliderEnabled;
    delete cleaned.sliderJson;
    delete cleaned.headerName;
    delete cleaned.faviconUrl;
    delete cleaned.posterUrl;
    if (cleaned.branding && typeof cleaned.branding === "object") {
      delete cleaned.branding.favicon;
    }
    return cleaned;
  }


  function buildConfigBlock(cfg){
    const normalized = normalizeConfig(cfg);
    const cleaned = sanitizeConfigForOutput(normalized);
    const json = JSON.stringify(cleaned, null, 2);
    return `${JS_BLOCK_START}\nwindow.BTFW_THEME_ADMIN = ${json};\n${JS_BLOCK_END}`;
  }

  function buildGradientCssVariables(cfg){
    const gradient = normalizeGradientConfig(cfg);
    const active = gradient.enabled;
    const noise = active ? gradientNoiseImage(gradient.noise) : "none";
    const compose = (layer, targetEnabled) => {
      if (!active || !targetEnabled) return { css: "none", count: 1 };
      if (noise === "none") return layer;
      return {
        css: `var(--btfw-gradient-noise),${layer.css}`,
        count: layer.count + 1,
        sizes: ["160px 160px", ...gradientLayerSizes(layer)],
        positions: ["0 0", ...gradientLayerPositions(layer)]
      };
    };
    const staticCfg = staticGradientTheme(cfg);
    // Channel CSS is shared by every viewer, so applied surfaces use the same
    // lightweight native gradient as the live runtime. Detailed filtered SVG
    // artwork remains confined to the toolkit preview.
    const page = active && gradient.targets.page
      ? renderRuntimeSurfaceGradient(staticCfg, 1)
      : { css: "none", count: 1 };
    const panel = active && gradient.targets.panels
      ? renderRuntimeSurfaceGradient(staticCfg, 0.7)
      : { css: "none", count: 1 };
    const panelSoft = active && gradient.targets.panels
      ? renderRuntimeSurfaceGradient(staticCfg, 0.42)
      : { css: "none", count: 1 };
    const navbar = active && gradient.targets.navbar
      ? renderRuntimeSurfaceGradient(staticCfg, 0.78)
      : { css: "none", count: 1 };
    return [
      `--btfw-gradient-noise:${noise}`,
      `--btfw-gradient-page-layer:${page.css}`,
      `--btfw-gradient-page-runtime-layer:${page.css}`,
      `--btfw-gradient-panel-layer:${panel.css}`,
      `--btfw-gradient-panel-runtime-layer:${panel.css}`,
      `--btfw-gradient-panel-soft-runtime-layer:${panelSoft.css}`,
      `--btfw-gradient-panel-soft-layer:${panelSoft.css}`,
      `--btfw-gradient-navbar-layer:${navbar.css}`,
      `--btfw-gradient-navbar-runtime-layer:${navbar.css}`,
      `--btfw-panel-background-size:${["var(--btfw-dither-size)", ...gradientLayerSizes(panel), ...Array(3).fill("auto")].join(",")}`,
      `--btfw-panel-background-position:${["0 0", ...gradientLayerPositions(panel), ...Array(3).fill("center")].join(",")}`,
      `--btfw-page-background-size:${["var(--btfw-dither-size)", ...gradientLayerSizes(page), "auto"].join(",")}`,
      `--btfw-page-background-position:${["0 0", ...gradientLayerPositions(page), "center top"].join(",")}`,
      `--btfw-navbar-gradient-size:${gradientLayerSizes(navbar).join(",")}`,
      `--btfw-navbar-gradient-position:${gradientLayerPositions(navbar).join(",")}`
    ].join(";") + ";";
  }
  function buildCssBlock(cfg){
    const colors = cfg.colors || {};
    const typography = resolveTypographyConfig(cfg.typography || {});
    const bg = colors.background || "#05060d";
    const surface = colors.surface || colors.panel || "#0b111d";
    const panel = colors.panel || "#141f36";
    const textColor = colors.text || "#e8ecfb";
    const chatText = colors.chatText || textColor;
    const accent = colors.accent || "#6d4df6";
    const fontFamily = typography.family || FONT_FALLBACK_FAMILY;
    const gradientCss = buildGradientCssVariables(cfg);

    // Optional Hero Pattern backdrop. The image goes on <html>, not <body>:
    // in this layout body is only viewport-tall while the document scrolls
    // well past it, so a body background stops at the first screen. The root
    // element's background paints the whole scroll canvas, so it tiles the
    // full page. body is made transparent (over the same bg color) so the
    // pattern also shows through the top screen. !important beats the
    // dark-mode bridge's `background:` shorthand that repaints these later.
    let patternCss = "";
    const bgCfg = cfg.background || {};
    if (bgCfg.pattern && bgCfg.pattern !== "none" && BG_PATTERNS[bgCfg.pattern]) {
      const image = patternImageValue(bgCfg.pattern, accent, bgCfg.intensity);
      if (image) {
        patternCss = `\nhtml {\n  background-color: ${bg} !important;\n  background-image: ${image} !important;\n  background-repeat: repeat !important;\n  background-attachment: scroll !important;\n  background-position: top center !important;\n}\nbody {\n  background-color: transparent !important;\n  background-image: none !important;\n}`;
      }
    }

    return `\n${CSS_BLOCK_START}\n:root {\n  --btfw-theme-bg: ${bg};\n  --btfw-theme-surface: ${surface};\n  --btfw-theme-panel: ${panel};\n  --btfw-theme-text: ${textColor};\n  --btfw-theme-chat-text: ${chatText};\n  --btfw-theme-accent: ${accent};\n  --btfw-theme-font-family: ${fontFamily};\n  ${gradientCss}\n}${patternCss}\n${CSS_BLOCK_END}`;
  }

// Replace this function in feature-channel-theme-admin.js

function replaceBlock(original, startMarker, endMarker, block){
  const sanitizedBlock = (block || "").trim();
  if (!sanitizedBlock) return original;

  const start = original.indexOf(startMarker);
  const end = original.indexOf(endMarker);
  const hadTrailingNewline = /\n\s*$/.test(original);

  if (start !== -1 && end !== -1 && end > start) {
    const before = original.slice(0, start).replace(/\s+$/, "");
    const after = original.slice(end + endMarker.length).replace(/^\s+/, "");
    return joinSections([before, sanitizedBlock, after], hadTrailingNewline);
  }

  const loaderStart = findLoaderStart(original);
  if (loaderStart !== -1) {
    const before = original.slice(0, loaderStart).replace(/\s+$/, "");
    const after = original.slice(loaderStart);
    return joinSections([before, sanitizedBlock, after], hadTrailingNewline);
  }


  const trimmed = original.trim();
  if (!trimmed) {
    return sanitizedBlock + "\n";
  }
  return joinSections([trimmed, sanitizedBlock], true);
}

  function canManageChannel(){
    try {
      if (typeof window.hasPermission === "function") {
        if (window.hasPermission("motdedit") || window.hasPermission("seehidden") || window.hasPermission("chanowner")) return true;
      }
      const client = window.CLIENT || null;
      if (client?.hasPermission) {
        if (client.hasPermission("motdedit") || client.hasPermission("seehidden") || client.hasPermission("chanowner")) return true;
      }
      if (client && typeof client.rank !== "undefined") {
        const rank = client.rank | 0;
        const ranks = window.RANK || window.Ranks || {};
        const owner = [ranks.owner, ranks.founder, ranks.admin, ranks.administrator].find(v => typeof v === "number");
        if (typeof owner === "number") return rank >= owner;
        return rank >= 4;
      }
    } catch (_) {}
    return false;
  }

  function ensureField(modal, selectors, fallbackId){
    for (const selector of selectors) {
      const el = modal ? modal.querySelector(selector) : document.querySelector(selector);
      if (el) return el;
    }
    const host = modal?.querySelector("form") || modal?.querySelector(".modal-body") || modal || document.body;
    const textarea = document.createElement("textarea");
    textarea.id = fallbackId;
    textarea.style.display = "none";
    textarea.dataset.btfwThemeAdmin = "synthetic";
    host.appendChild(textarea);
    return textarea;
  }

  function normalizeTargetId(raw){
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (str.startsWith("#")) return str.slice(1);
    if (/^[A-Za-z][\w:-]*$/.test(str)) return str;
    return null;
  }

  function setActiveTab(tabContainer, contentContainer, panel, trigger){
    if (!panel || !tabContainer) return;
    const anchors = Array.from(tabContainer.querySelectorAll("a[href^='#'], a[data-target^='#']"));
    anchors.forEach(anchor => {
      const host = anchor.closest("li, [role='tab'], .tab") || anchor;
      const targetAttr = anchor.getAttribute("data-target") || anchor.getAttribute("href") || "";
      const targetId = normalizeTargetId(targetAttr);
      const isActive = trigger ? anchor === trigger : (targetId && targetId === panel.id);
      host.classList.toggle("active", !!isActive);
      host.classList.toggle("is-active", !!isActive);
      if (host.setAttribute) host.setAttribute("aria-selected", isActive ? "true" : "false");
      anchor.classList.toggle("active", !!isActive);
      anchor.classList.toggle("is-active", !!isActive);
    });

    const container = contentContainer || panel.parentElement;
    if (!container) return;
    const panes = Array.from(container.querySelectorAll(".tab-pane, [role='tabpanel'], .modal-tab, .tab-panel"));
    panes.forEach(pane => {
      const active = pane === panel;
      pane.classList.toggle("active", active);
      pane.classList.toggle("is-active", active);
      if (pane.classList.contains("tab-pane")) {
        pane.classList.toggle("in", active);
      }
      pane.style.display = active ? "block" : "none";
      if (pane.setAttribute) pane.setAttribute("aria-hidden", active ? "false" : "true");
    });
  }

  function ensureTabSystem(modal){
    if (!modal) return { tabContainer: null, contentContainer: null };
    const tabContainer = modal.querySelector(".nav-tabs, .modal-tabs, [role='tablist']");
    const contentContainer = modal.querySelector(".tab-content, .modal-content .modal-body, .modal-body");

    if (tabContainer && !tabContainer.dataset.btfwTabsWired) {
      tabContainer.dataset.btfwTabsWired = "1";
      tabContainer.addEventListener("click", (event) => {
        const anchor = event.target.closest("a[href^='#'], a[data-target^='#']");
        if (!anchor) return;
        const rawTarget = anchor.getAttribute("data-target") || anchor.getAttribute("href") || "";
        const normalized = normalizeTargetId(rawTarget);
        if (!normalized) return;
        let panel = document.getElementById(normalized);
        if (panel && !modal.contains(panel)) panel = null;
        if (!panel) return;
        event.preventDefault();
        setActiveTab(tabContainer, contentContainer, panel, anchor);
      }, true);
    }

    return { tabContainer, contentContainer };
  }

  // Pick black or white for text drawn on top of `hex`, based on luminance.
  function readableTextOn(hex){
    const c = String(hex || "").replace("#", "");
    if (c.length < 6) return "#ffffff";
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return "#ffffff";
    return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.6 ? "#0b0e16" : "#ffffff";
  }

  function paintPatternPreviews(panel, cfg){
    const colors = cfg.colors || {};
    const bg = colors.background || "#05060d";
    const accent = colors.accent || "#6d4df6";
    const selected = cfg.background?.pattern || "none";
    panel.querySelectorAll(".btfw-pattern-tile").forEach(tile => {
      const key = tile.dataset.pattern;
      const active = key === selected;
      tile.classList.toggle("is-active", active);
      tile.setAttribute("aria-checked", active ? "true" : "false");
      tile.tabIndex = active ? 0 : -1;
      if (key === "none") return;
      tile.style.backgroundColor = bg;
      // tiles preview at a fixed readable opacity; intensity applies on Apply
      tile.style.backgroundImage = patternImageValue(key, accent, "bold");
    });
    const intensityRow = panel.querySelector('[data-role="pattern-intensity-row"]');
    if (intensityRow) intensityRow.hidden = selected === "none";
  }

  function wirePatternPicker(panel, cfg){
    const grid = panel.querySelector('[data-role="pattern-grid"]');
    const input = panel.querySelector('[data-role="pattern-input"]');
    if (!grid || !input || grid.dataset.wired === "1") return;
    grid.dataset.wired = "1";
    const entries = [["none", { label: "None" }]].concat(Object.entries(BG_PATTERNS));
    const selectTile = (tile, options = {}) => {
      if (!tile) return;
      const key = tile.dataset.pattern;
      input.value = key;
      // route through the standard bind flow so collectConfig/markDirty see it
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (cfg.background && typeof cfg.background === "object") cfg.background.pattern = key;
      paintPatternPreviews(panel, cfg);
      if (options.focus) tile.focus({ preventScroll: true });
      tile.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    };

    entries.forEach(([key, def]) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "btfw-pattern-tile" + (key === "none" ? " btfw-pattern-tile--none" : "");
      tile.dataset.pattern = key;
      tile.title = def.label;
      tile.setAttribute("role", "radio");
      tile.setAttribute("aria-label", def.label);
      if (key === "none") {
        tile.textContent = "None";
      } else {
        const label = document.createElement("span");
        label.className = "btfw-pattern-tile__label";
        label.textContent = def.label;
        tile.appendChild(label);
      }
      tile.addEventListener("click", () => selectTile(tile));
      grid.appendChild(tile);
    });

    grid.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      const tiles = Array.from(grid.querySelectorAll(".btfw-pattern-tile"));
      if (!tiles.length) return;
      const current = event.target.closest(".btfw-pattern-tile");
      let index = Math.max(0, tiles.indexOf(current));
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tiles.length - 1;
      else if (event.key === "ArrowLeft") index = Math.max(0, index - 1);
      else index = Math.min(tiles.length - 1, index + 1);
      event.preventDefault();
      selectTile(tiles[index], { focus: true });
    });

    let dragState = null;
    let suppressClick = false;
    grid.addEventListener("dragstart", (event) => event.preventDefault());
    grid.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragState = {
        id: event.pointerId,
        startX: event.clientX,
        startScroll: grid.scrollLeft,
        moved: false
      };
    });
    grid.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.id !== event.pointerId) return;
      const delta = event.clientX - dragState.startX;
      if (!dragState.moved && Math.abs(delta) < 4) return;
      if (!dragState.moved) {
        dragState.moved = true;
        grid.classList.add("is-dragging");
        // Capture only after this is definitely a drag. Capturing on pointerdown
        // retargets a normal click to the strip and prevents the tile from
        // receiving its click event.
        try { grid.setPointerCapture(event.pointerId); } catch (_) {}
      }
      grid.scrollLeft = dragState.startScroll - delta;
      event.preventDefault();
    });
    const finishDrag = (event) => {
      if (!dragState || (event.pointerId != null && dragState.id !== event.pointerId)) return;
      const moved = dragState.moved;
      const pointerId = dragState.id;
      dragState = null;
      grid.classList.remove("is-dragging");
      if (moved) {
        try { grid.releasePointerCapture(pointerId); } catch (_) {}
      }
      if (moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      }
    };
    grid.addEventListener("pointerleave", (event) => {
      if (!dragState || dragState.id !== event.pointerId || dragState.moved) return;
      dragState = null;
    });
    grid.addEventListener("pointerup", finishDrag);
    grid.addEventListener("pointercancel", finishDrag);
    grid.addEventListener("lostpointercapture", finishDrag);
    grid.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    paintPatternPreviews(panel, cfg);
    requestAnimationFrame(() => {
      const active = grid.querySelector(".btfw-pattern-tile.is-active");
      active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    });
  }

  function renderPreview(panel, cfg){
    const colors = cfg.colors || {};
    const typography = applyLiveTypographyAssets(cfg.typography || {}, { scope: "preview" });

    // Live mini-mockup: feed the palette into CSS vars so the preview renders the
    // colors in real context (panel card + chat + accent button), all readable.
    const preview = panel.querySelector(".preview");
    if (preview) {
      const bg = colors.background || "#05060d";
      const surface = colors.surface || colors.panel || "#0b111d";
      const pnl = colors.panel || "#141f36";
      const text = colors.text || "#e8ecf7";
      const chat = colors.chatText || colors.text || "#cfd6e6";
      const accent = colors.accent || "#6d4df6";
      preview.style.setProperty("--bg", bg);
      preview.style.setProperty("--surface", surface);
      preview.style.setProperty("--panel", pnl);
      preview.style.setProperty("--text", text);
      preview.style.setProperty("--chat", chat);
      preview.style.setProperty("--accent", accent);
      preview.style.setProperty("--on-accent", readableTextOn(accent));
      const material = cfg.material && typeof cfg.material === "object" ? cfg.material : DEFAULT_CONFIG.material;
      const ditherIntensity = DITHER_INTENSITIES.includes(material.ditherIntensity)
        ? material.ditherIntensity
        : "subtle";
      preview.dataset.dither = material.dither ? ditherIntensity : "off";
      const gradient = normalizeGradientConfig(cfg);
      const staticCfg = staticGradientTheme(cfg);
      const panelGradient = gradient.enabled && gradient.targets.panels ? renderRuntimeSurfaceGradient(staticCfg, 0.7) : { css: "none", count: 1 };
      const softGradient = gradient.enabled && gradient.targets.panels ? renderRuntimeSurfaceGradient(staticCfg, 0.42) : { css: "none", count: 1 };
      const navbarGradient = gradient.enabled && gradient.targets.navbar ? renderRuntimeSurfaceGradient(staticCfg, 0.78) : { css: "none", count: 1 };
      const pageGradient = gradient.enabled && gradient.targets.page ? renderRuntimeSurfaceGradient(staticCfg, 1) : { css: "none", count: 1 };
      preview.style.setProperty("--btfw-tp-gradient-panel", panelGradient.css);
      preview.style.setProperty("--btfw-tp-gradient-soft", softGradient.css);
      preview.style.setProperty("--btfw-tp-gradient-navbar", navbarGradient.css);
      preview.style.setProperty("--btfw-tp-panel-background-size", ["var(--btfw-tp-dither-size)", ...gradientLayerSizes(panelGradient), ...Array(3).fill("auto")].join(", "));
      preview.style.setProperty("--btfw-tp-panel-background-position", ["0 0", ...gradientLayerPositions(panelGradient), ...Array(3).fill("center")].join(", "));
      preview.style.setProperty("--btfw-tp-soft-background-size", ["var(--btfw-tp-dither-size)", ...gradientLayerSizes(softGradient), ...Array(2).fill("auto")].join(", "));
      preview.style.setProperty("--btfw-tp-soft-background-position", ["0 0", ...gradientLayerPositions(softGradient), ...Array(2).fill("center")].join(", "));
      preview.style.setProperty("--btfw-tp-navbar-background-size", [...gradientLayerSizes(navbarGradient), "var(--btfw-tp-dither-size)", ...gradientLayerSizes(softGradient), ...Array(2).fill("auto")].join(", "));
      preview.style.setProperty("--btfw-tp-navbar-background-position", [...gradientLayerPositions(navbarGradient), "0 0", ...gradientLayerPositions(softGradient), ...Array(2).fill("center")].join(", "));
      preview.style.background = "";
      // Show the chosen page gradient and optional tiled pattern together.
      const previewBody = preview.querySelector(".btfw-tp__body");
      if (previewBody) {
        const patternKey = cfg.background?.pattern || "none";
        const layers = [];
        const layerSizes = [];
        const layerPositions = [];
        if (gradient.enabled && gradient.targets.page) {
          layers.push(pageGradient.css);
          layerSizes.push(...gradientLayerSizes(pageGradient));
          layerPositions.push(...gradientLayerPositions(pageGradient));
        }
        if (patternKey !== "none") {
          layers.push(patternImageValue(patternKey, accent, cfg.background?.intensity || "medium"));
          layerSizes.push("auto");
          layerPositions.push("top center");
        }
        previewBody.style.backgroundColor = bg;
        previewBody.style.backgroundImage = layers.join(", ");
        previewBody.style.backgroundSize = layerSizes.join(", ");
        previewBody.style.backgroundPosition = layerPositions.join(", ");
      }
    }
    paintPatternPreviews(panel, cfg);
    syncGradientEditor(panel, cfg);
    // Show each swatch's current hex, readably.
    panel.querySelectorAll(".btfw-swatch__hex[data-hex]").forEach(h => {
      const v = colors[h.dataset.hex];
      h.textContent = v ? String(v).toUpperCase() : "";
    });

    const fontPreview = panel.querySelector('.preview--font');
    if (fontPreview) {
      if (typography.family) {
        fontPreview.style.fontFamily = typography.family;
      }
      const nameNode = fontPreview.querySelector('[data-role="font-name"]');
      if (nameNode) {
        nameNode.textContent = typography.label || 'Inter';
      }
      const sampleNode = fontPreview.querySelector('[data-role="font-sample"]');
      if (sampleNode) {
        sampleNode.style.fontFamily = typography.family || FONT_FALLBACK_FAMILY;
      }
    }
  }

  function updateSliderFieldState(panel){
    const toggle = panel.querySelector('#btfw-theme-slider-enabled');
    const input = panel.querySelector('#btfw-theme-slider-json');
    if (!toggle || !input) return;
    const enabled = Boolean(toggle.checked);
    input.disabled = !enabled;
    const field = input.closest('.field');
    if (field) {
      field.classList.toggle('is-disabled', !enabled);
    }
  }

  function updateTypographyFieldState(panel){
    const select = panel.querySelector('#btfw-theme-font');
    const field = panel.querySelector('#btfw-theme-font-custom-field');
    const input = panel.querySelector('#btfw-theme-font-custom');
    const isCustom = (select?.value || '').toLowerCase() === 'custom';
    if (input) {
      input.disabled = !isCustom;
    }
    if (field) {
      field.classList.toggle('is-disabled', !isCustom);
    }
  }

  function setActiveGradientBand(panel, index){
    const balance = panel?.querySelector("[data-role=gradient-balance]");
    if (!balance) return;
    const selected = Math.max(0, Math.min(3, Number(index) || 0));
    balance.dataset.activeStop = String(selected);
    panel.querySelectorAll(".btfw-gradient-stop").forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === selected);
    });
  }

  function syncGradientEditor(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    const gradient = normalizeGradientConfig(cfg);
    const button = panel.querySelector("#btfw-theme-gradient-toggle");
    const input = panel.querySelector("#btfw-theme-gradient-enabled");
    const editor = panel.querySelector("[data-role=gradient-editor-fields]");
    const enabled = Boolean(gradient.enabled);
    if (input) input.checked = enabled;
    if (button) {
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      const state = button.querySelector("[data-role=state-label]");
      if (state) state.textContent = enabled ? "On" : "Off";
    }
    if (editor) editor.hidden = !enabled;

    const typeInput = panel.querySelector("#btfw-gradient-type");
    if (typeInput) typeInput.value = gradient.type;
    panel.querySelectorAll("[data-gradient-type]").forEach(typeButton => {
      const type = typeButton.dataset.gradientType;
      const selected = type === gradient.type;
      typeButton.setAttribute("aria-selected", selected ? "true" : "false");
      typeButton.tabIndex = selected ? 0 : -1;
      const thumbnail = typeButton.querySelector(".btfw-gradient-type__preview");
      if (thumbnail && GRADIENT_TYPES.includes(type)) {
        const thumbConfig = { ...cfg, gradient: { ...gradient, type, motion: "off", balance: [...gradient.balance], stops: gradient.stops.map(stop => ({ ...stop })) } };
        const thumbLayer = renderRuntimeSurfaceGradient(thumbConfig, 1.8);
        thumbnail.style.backgroundImage = thumbLayer.css;
        thumbnail.style.backgroundSize = (thumbLayer.sizes || Array(thumbLayer.count).fill("cover")).join(", ");
        thumbnail.style.backgroundPosition = (thumbLayer.positions || Array(thumbLayer.count).fill("center")).join(", ");
      }
    });

    const paletteMode = gradient.source === "palette";
    const colors = cfg.colors && typeof cfg.colors === "object" ? cfg.colors : DEFAULT_CONFIG.colors;
    const stops = getGradientStops(cfg);
    const balance = panel.querySelector("[data-role=gradient-balance]");
    const activeIndex = Math.max(0, Math.min(3, Number(balance?.dataset.activeStop) || 0));
    panel.querySelectorAll(".btfw-gradient-stop").forEach((card, index) => {
      const stop = stops[index];
      if (!stop) return;
      const colorInput = card.querySelector("[data-role=gradient-stop-color]");
      const name = card.querySelector("[data-role=gradient-stop-name]");
      if (colorInput) { colorInput.value = stop.color; colorInput.disabled = paletteMode; }
      if (name) name.textContent = paletteMode ? stop.paletteKey.replace(/^./, char => char.toUpperCase()) : `Color ${index + 1}`;
      card.classList.toggle("is-active", index === activeIndex);
    });

    const colorPath = stops.map(stop => `${stop.color} ${stop.position}%`).join(", ");
    if (balance) {
      balance.style.setProperty("--btfw-gradient-balance-fill", `linear-gradient(90deg in oklab, ${colorPath})`);
      gradient.balance.forEach((value, index) => {
        const handle = balance.querySelector(`[data-balance-index="${index}"]`);
        if (!handle) return;
        const lower = index === 0 ? 6 : gradient.balance[index - 1] + 6;
        const upper = index === 2 ? 94 : gradient.balance[index + 1] - 6;
        handle.style.left = `${value}%`;
        handle.setAttribute("aria-valuemin", String(lower));
        handle.setAttribute("aria-valuemax", String(upper));
        handle.setAttribute("aria-valuenow", String(value));
      });
      const edges = [0, ...gradient.balance, 100];
      const activeBand = balance.querySelector("[data-role=gradient-active-band]");
      if (activeBand) {
        activeBand.style.left = `${edges[activeIndex]}%`;
        activeBand.style.width = `${edges[activeIndex + 1] - edges[activeIndex]}%`;
      }
    }

    const stage = panel.querySelector("[data-role=gradient-stage]");
    const visual = panel.querySelector("[data-role=gradient-stage-visual]");
    if (stage && visual) {
      const stageLayer = renderGradientLayer(cfg, 2.15);
      stage.dataset.gradientType = gradient.type;
      stage.dataset.gradientMotion = gradient.motion;
      stage.style.setProperty("--btfw-gradient-stage-noise", gradientNoiseImage(gradient.noise));
      visual.style.backgroundColor = colors.background || DEFAULT_CONFIG.colors.background;
      visual.style.backgroundImage = stageLayer.css;
      visual.style.backgroundSize = (stageLayer.sizes || Array(stageLayer.count).fill("cover")).join(", ");
      visual.style.backgroundPosition = (stageLayer.positions || Array(stageLayer.count).fill("center")).join(", ");
      const label = stage.querySelector("[data-role=gradient-stage-label]");
      if (label) {
        const animated = gradient.motion !== "off";
        label.textContent = `${GRADIENT_TYPE_LABELS[gradient.type]} · ${animated ? "animated" : "static"}`;
      }
    }

    const angleOutput = panel.querySelector("[data-role=gradient-angle-value]");
    if (angleOutput) angleOutput.textContent = `${gradient.angle}°`;
    const strengthOutput = panel.querySelector("[data-role=gradient-strength-value]");
    if (strengthOutput) strengthOutput.textContent = `${gradient.strength}%`;
    const softenOutput = panel.querySelector("[data-role=gradient-soften-value]");
    if (softenOutput) softenOutput.textContent = `${gradient.soften}px`;
    const noiseOutput = panel.querySelector("[data-role=gradient-noise-value]");
    if (noiseOutput) noiseOutput.textContent = `${gradient.noise}%`;
    const angleField = panel.querySelector("[data-role=gradient-angle-field]");
    if (angleField) angleField.hidden = gradient.type !== "linear";
    rangeSliders.syncAll(panel);
  }

  function syncDitherToggle(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    if (!cfg.material || typeof cfg.material !== "object") {
      cfg.material = JSON.parse(JSON.stringify(DEFAULT_CONFIG.material));
    }
    const button = panel.querySelector('#btfw-theme-dither-toggle');
    const input = panel.querySelector('#btfw-theme-dither-enabled');
    const intensity = panel.querySelector('#btfw-theme-dither-intensity');
    const intensityRow = panel.querySelector('[data-role="dither-intensity-row"]');
    if (!button || !input) return;
    const enabled = Boolean(cfg.material.dither);
    input.checked = enabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const state = button.querySelector('[data-role="state-label"]');
    if (state) state.textContent = enabled ? 'On' : 'Off';
    if (intensity) intensity.disabled = !enabled;
    if (intensityRow) intensityRow.hidden = !enabled;
  }

  function syncMovieInfoToggle(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    const integrations = cfg.integrations = cfg.integrations && typeof cfg.integrations === "object"
      ? cfg.integrations
      : (cfg.integrations = JSON.parse(JSON.stringify(DEFAULT_CONFIG.integrations)));
    if (!integrations.movieInfo || typeof integrations.movieInfo !== "object") {
      integrations.movieInfo = { enabled: false };
    }
    const button = panel.querySelector('#btfw-theme-movie-info-toggle');
    const input = panel.querySelector('#btfw-theme-movie-info-enabled');
    if (!button || !input) return;
    const tmdbField = panel.querySelector('#btfw-theme-integrations-tmdb');
    const enabled = Boolean(integrations.movieInfo.enabled);
    input.checked = enabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const movieInfoState = button.querySelector('[data-role="state-label"]');
    if (movieInfoState) movieInfoState.textContent = enabled ? 'On' : 'Off';
    const notice = panel.querySelector('[data-role="movie-info-requirements"]');
    if (notice) {
      const keyFromCfg = typeof integrations.tmdb?.apiKey === 'string' ? integrations.tmdb.apiKey.trim() : '';
      const keyFromField = typeof tmdbField?.value === 'string' ? tmdbField.value.trim() : '';
      const hasKey = Boolean(keyFromCfg || keyFromField);
      if (!enabled) {
        notice.hidden = true;
        notice.classList.remove('is-warning', 'is-success');
      } else {
        notice.hidden = false;
        notice.classList.toggle('is-warning', !hasKey);
        notice.classList.toggle('is-success', hasKey);
        notice.textContent = hasKey
          ? 'Movie info will use your TMDB API key to show posters, backdrops, and ratings when viewers hover over the now playing title.'
          : 'Requires a TMDB API key. Add the key above before enabling to avoid empty results.';
      }
    }
  }

  function syncMoviePollToggle(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    if (!cfg.moviePoll || typeof cfg.moviePoll !== "object") cfg.moviePoll = { enabled: false };
    const button = panel.querySelector('#btfw-theme-movie-poll-toggle');
    const input = panel.querySelector('#btfw-theme-movie-poll-enabled');
    if (!button || !input) return;
    const tmdbField = panel.querySelector('#btfw-theme-integrations-tmdb');
    const enabled = Boolean(cfg.moviePoll.enabled);
    input.checked = enabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const state = button.querySelector('[data-role="state-label"]');
    if (state) state.textContent = enabled ? 'On' : 'Off';
    const notice = panel.querySelector('[data-role="movie-poll-requirements"]');
    if (notice) {
      const keyFromCfg = typeof cfg.integrations?.tmdb?.apiKey === 'string' ? cfg.integrations.tmdb.apiKey.trim() : '';
      const keyFromField = typeof tmdbField?.value === 'string' ? tmdbField.value.trim() : '';
      const hasKey = Boolean(keyFromCfg || keyFromField);
      notice.hidden = !enabled || hasKey;
    }
  }

  function syncAutoSubsToggle(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    const integrations = cfg.integrations = cfg.integrations && typeof cfg.integrations === "object"
      ? cfg.integrations
      : (cfg.integrations = JSON.parse(JSON.stringify(DEFAULT_CONFIG.integrations)));
    if (!integrations.autoSubs || typeof integrations.autoSubs !== "object") {
      integrations.autoSubs = { enabled: false };
    }
    const button = panel.querySelector('#btfw-theme-auto-subs-toggle');
    const input = panel.querySelector('#btfw-theme-auto-subs-enabled');
    if (!button || !input) return;
    const tmdbField = panel.querySelector('#btfw-theme-integrations-tmdb');
    const wyzieField = panel.querySelector('#btfw-theme-integrations-wyzie');
    const enabled = Boolean(integrations.autoSubs.enabled);
    input.checked = enabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const autoSubsState = button.querySelector('[data-role="state-label"]');
    if (autoSubsState) autoSubsState.textContent = enabled ? 'On' : 'Off';
    const notice = panel.querySelector('[data-role="auto-subs-requirements"]');
    if (notice) {
      const keyFromCfg = typeof integrations.tmdb?.apiKey === 'string' ? integrations.tmdb.apiKey.trim() : '';
      const keyFromField = typeof tmdbField?.value === 'string' ? tmdbField.value.trim() : '';
      const wyzieFromCfg = typeof integrations.wyzie?.apiKey === 'string' ? integrations.wyzie.apiKey.trim() : '';
      const wyzieFromField = typeof wyzieField?.value === 'string' ? wyzieField.value.trim() : '';
      const subdlField = panel.querySelector('#btfw-theme-integrations-subdl');
      const subdlFromCfg = typeof integrations.subdl?.apiKey === 'string' ? integrations.subdl.apiKey.trim() : '';
      const subdlFromField = typeof subdlField?.value === 'string' ? subdlField.value.trim() : '';
      const hasTmdb = Boolean(keyFromCfg || keyFromField);
      const hasWyzie = Boolean(wyzieFromCfg || wyzieFromField);
      const hasSubdl = Boolean(subdlFromCfg || subdlFromField);
      if (!enabled) {
        notice.hidden = true;
        notice.classList.remove('is-warning', 'is-success');
      } else {
        notice.hidden = false;
        notice.classList.toggle('is-warning', !hasTmdb);
        notice.classList.toggle('is-success', hasTmdb);
        if (!hasTmdb) {
          notice.textContent = 'Requires a TMDB API key before enabling.';
        } else if (hasWyzie || hasSubdl) {
          const sources = [hasWyzie && 'Wyzie', hasSubdl && 'SubDL'].filter(Boolean).join(' + ');
          notice.textContent = `Auto subtitles will use ${sources}, with a community Stremio addon as a keyless fallback.`;
        } else {
          notice.textContent = 'No Wyzie or SubDL key set — using the community Stremio addon (less reliable). Add a key above for better coverage.';
        }
      }
    }
  }

  function syncAudioEnhancerToggle(panel, cfg){
    if (!panel || !cfg || typeof cfg !== "object") return;
    const integrations = cfg.integrations = cfg.integrations && typeof cfg.integrations === "object"
      ? cfg.integrations
      : (cfg.integrations = JSON.parse(JSON.stringify(DEFAULT_CONFIG.integrations)));
    if (!integrations.audioEnhancer || typeof integrations.audioEnhancer !== "object") {
      integrations.audioEnhancer = { enabled: false };
    }
    const button = panel.querySelector('#btfw-theme-audio-enhancer-toggle');
    const input = panel.querySelector('#btfw-theme-audio-enhancer-enabled');
    if (!button || !input) return;
    const enabled = Boolean(integrations.audioEnhancer.enabled);
    input.checked = enabled;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const audioEnhancerState = button.querySelector('[data-role="state-label"]');
    if (audioEnhancerState) audioEnhancerState.textContent = enabled ? 'On' : 'Off';
  }

  /* --- BillTube chat-filter status (top of toolkit) ------------------------
     Compares the channel's imported chat filters against the canonical list in
     feature:chat-filters, matched by name. Channel-authored filters (names we
     don't own) are ignored, but their presence downgrades the guidance because
     CyTube's "Import filter list" replaces the whole list. --- */
  let filterStatusLastCheck = 0;

  function fetchChannelFilters(timeoutMs = 5000){
    return new Promise((resolve) => {
      const s = window.socket;
      if (!s || typeof s.emit !== "function" || typeof s.on !== "function") { resolve(null); return; }
      let settled = false;
      const onFilters = (list) => finish(Array.isArray(list) ? list : null);
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          if (typeof s.off === "function") s.off("chatFilters", onFilters);
          else if (typeof s.removeListener === "function") s.removeListener("chatFilters", onFilters);
        } catch (_) {}
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      try {
        s.on("chatFilters", onFilters);
        s.emit("requestChatFilters");
      } catch (_) {
        finish(null);
      }
    });
  }

  async function getRequiredFilters(){
    try {
      const mod = await window.BTFW.init("feature:chat-filters");
      if (mod && Array.isArray(mod.filters) && mod.filters.length) return mod.filters;
    } catch (_) {}
    return null;
  }

  function diffRequiredFilters(channelFilters, requiredFilters){
    const byName = new Map();
    channelFilters.forEach((f) => {
      if (f && typeof f.name === "string") byName.set(f.name, f);
    });
    const missing = [];
    const changed = [];
    requiredFilters.forEach((req) => {
      const cur = byName.get(req.name);
      if (!cur) { missing.push(req.name); return; }
      if (String(cur.source) !== String(req.source)
        || String(cur.flags) !== String(req.flags)
        || String(cur.replace) !== String(req.replace)) {
        changed.push(req.name);
      }
    });
    const ours = new Set(requiredFilters.map((f) => f.name));
    const extras = channelFilters.filter((f) => f && typeof f.name === "string" && !ours.has(f.name)).length;
    return { missing, changed, extras };
  }

  function setFilterStatus(panel, state, message, note){
    const box = panel.querySelector('[data-role="filter-status"]');
    if (!box) return;
    box.dataset.state = state;
    const msg = box.querySelector('[data-role="filter-status-message"]');
    if (msg) msg.textContent = message;
    const noteEl = box.querySelector('[data-role="filter-status-note"]');
    if (noteEl) {
      noteEl.textContent = note || "";
      noteEl.hidden = !note;
    }
    const openBtn = box.querySelector('[data-role="filter-status-open"]');
    if (openBtn) openBtn.hidden = state !== "outdated";
  }

  async function runFilterStatusCheck(panel){
    const box = panel.querySelector('[data-role="filter-status"]');
    if (!box || box.dataset.checking === "1") return;
    box.dataset.checking = "1";
    filterStatusLastCheck = Date.now();
    setFilterStatus(panel, "checking", "Checking channel filters…");
    try {
      const required = await getRequiredFilters();
      if (!required) {
        setFilterStatus(panel, "unknown", "BillTube filter list is unavailable in this session.");
        return;
      }
      const channelFilters = await fetchChannelFilters();
      if (!channelFilters) {
        setFilterStatus(panel, "unknown", "Couldn't read this channel's filters — check your connection and filter permissions, then re-check.");
        return;
      }
      const diff = diffRequiredFilters(channelFilters, required);
      if (!diff.missing.length && !diff.changed.length) {
        setFilterStatus(panel, "ok", `Up to date — all ${required.length} BillTube filters match.`);
        return;
      }
      const parts = [];
      if (diff.changed.length) parts.push(`${diff.changed.length} outdated`);
      if (diff.missing.length) parts.push(`${diff.missing.length} missing`);
      const affected = diff.changed.concat(diff.missing);
      const shown = affected.slice(0, 6).join(", ");
      let note = `Affected: ${shown}${affected.length > 6 ? ", …" : ""}. In the Chat Filters tab, click "Import Required BillTube Chat Filters", then CyTube's "Import filter list".`;
      if (diff.extras > 0) {
        note += ` Warning: this channel also has ${diff.extras} custom filter${diff.extras === 1 ? "" : "s"} of its own — importing replaces the whole list, so export those first and re-add them after.`;
      }
      setFilterStatus(panel, "outdated", `Update needed — ${parts.join(", ")}.`, note);
    } finally {
      delete box.dataset.checking;
    }
  }

  function wireFilterStatus(panel){
    const box = panel.querySelector('[data-role="filter-status"]');
    if (!box || box.dataset.wired === "1") return;
    box.dataset.wired = "1";
    const refreshBtn = box.querySelector('[data-role="filter-status-refresh"]');
    if (refreshBtn) refreshBtn.addEventListener("click", () => runFilterStatusCheck(panel));
    const openBtn = box.querySelector('[data-role="filter-status-open"]');
    if (openBtn) openBtn.addEventListener("click", () => {
      const link = document.querySelector('a[href="#cs-chatfilters"]');
      if (link) link.click();
    });
    runFilterStatusCheck(panel);
  }

  /* --- Backup & Restore -----------------------------------------------
     Export: the current panel state (same normalized shape that gets written
     to Channel JS) wrapped with format/version metadata. Import: accepts that
     wrapper OR a raw config object, then upgrades it through the exact same
     path stored configs take on load — deepMerge over cloneDefaults() — so
     old backups keep working as new settings (patterns, events, …) are added:
     missing keys pick up current defaults. Nothing is published until the
     owner reviews and clicks Apply. */
  function wireBackup(panel, cfg){
    const exportBtn = panel.querySelector('[data-role="backup-export"]');
    const importBtn = panel.querySelector('[data-role="backup-import"]');
    const fileInput = panel.querySelector('[data-role="backup-file"]');
    const statusEl = panel.querySelector('[data-role="backup-status"]');
    if (!exportBtn || !importBtn || !fileInput || exportBtn.dataset.wired === "1") return;
    exportBtn.dataset.wired = "1";

    const setStatus = (msg, isError) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = isError ? "var(--btfw-color-error, #ff6f96)" : "";
    };

    exportBtn.addEventListener("click", () => {
      try {
        const current = collectConfig(panel, cfg);
        const payload = {
          format: "btfw-theme-backup",
          version: Number(current.version) || DEFAULT_CONFIG.version,
          exportedAt: new Date().toISOString(),
          channel: (window.CHANNEL && window.CHANNEL.name) || "",
          config: current
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        const day = new Date().toISOString().slice(0, 10);
        a.href = URL.createObjectURL(blob);
        a.download = `billtube-theme-${payload.channel || "channel"}-${day}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setStatus("Backup downloaded. It includes API keys — keep it private.");
      } catch (err) {
        setStatus("Export failed: " + (err && err.message || err), true);
      }
    });

    importBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const raw = parsed && parsed.format === "btfw-theme-backup" ? parsed.config : parsed;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error("not a theme backup file");
        }
        const backupVersion = Number(parsed && parsed.version) || Number(raw.version) || 0;
        // Same upgrade path as stored configs: defaults fill anything the
        // backup predates; newer-than-us backups still load, minus unknowns.
        const merged = deepMerge(cloneDefaults(), raw);
        merged.version = DEFAULT_CONFIG.version;
        overwriteConfig(cfg, merged);
        updateInputs(panel, cfg);
        paintPatternPreviews(panel, cfg);
        // nudge the dirty-tracking so the Apply hint appears
        const tint = panel.querySelector('#btfw-theme-tint');
        if (tint) tint.dispatchEvent(new Event("change", { bubbles: true }));
        const note = backupVersion > DEFAULT_CONFIG.version
          ? ` (backup is from a newer theme v${backupVersion}; unknown settings were kept as-is)`
          : "";
        setStatus(`Backup loaded${note}. Review the sections, then click Apply to publish.`);
      } catch (err) {
        setStatus("Import failed: " + (err && err.message || err), true);
      }
    });
  }

  /* --- Dashboard navigation ---------------------------------------------
     The sections render as one visible pane at a time, selected from a left
     nav rail (horizontal chips on phones). The <details> elements stay open
     in the DOM so every existing binding keeps working; the active class alone
     controls which pane is visible. */
  const ADMIN_NAV_ICONS = {
    resources: "fa-layer-group",
    event: "fa-calendar-days",
    integrations: "fa-plug",
    playlistCatalogue: "fa-film",
    emoteMarketplace: "fa-store",
    palette: "fa-palette",
    typography: "fa-font",
    branding: "fa-tag",
    developer: "fa-code",
    backup: "fa-floppy-disk"
  };

  function wireAdminNav(panel){
    const nav = panel.querySelector('[data-role="admin-nav"]');
    const panes = $$('.btfw-admin-panes > details.section', panel);
    if (!nav || nav.dataset.wired === "1" || !panes.length) return;
    nav.dataset.wired = "1";
    const channelKey = (() => {
      try {
        const configured = String(window.CHANNEL?.name || "").trim();
        if (configured) return configured;
        const match = String(location.pathname || "").match(/^\/r\/([^/?#]+)/i);
        return match ? decodeURIComponent(match[1]) : "default";
      } catch (_) {
        return "default";
      }
    })();
    const KEY = `btfw:toolkit:last-section:v2:${channelKey.toLowerCase()}`;
    const show = (key, persist = true) => {
      if (!panes.some(d => d.dataset.section === key)) {
        key = panes[0].dataset.section;
      }
      panes.forEach(d => {
        d.open = true;
        d.classList.toggle("is-active-pane", d.dataset.section === key);
      });
      nav.querySelectorAll(".btfw-admin-nav__item").forEach(b => {
        const selected = b.dataset.section === key;
        b.classList.toggle("is-active", selected);
        if (selected) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });
      if (persist) { try { localStorage.setItem(KEY, key); } catch (_) {} }
    };

    panes.forEach(d => {
      const title = d.querySelector(".section__title h4")?.textContent?.trim() || d.dataset.section;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btfw-admin-nav__item";
      btn.dataset.section = d.dataset.section;
      btn.title = title;
      btn.innerHTML = `<i class="fa-solid ${ADMIN_NAV_ICONS[d.dataset.section] || "fa-circle"}" aria-hidden="true"></i><span>${title}</span>`;
      btn.addEventListener("click", () => show(d.dataset.section));
      nav.appendChild(btn);
    });

    let initial = panes[0].dataset.section;
    try { initial = localStorage.getItem(KEY) || initial; } catch (_) {}
    show(initial, false);
  }

  function renderPanel(panel){
    injectLocalStyles();
    panel.innerHTML = `
      <div class="btfw-theme-admin">
        <h3>Channel Theme Toolkit</h3>
        <p class="lead">Configure your BillTube channel's featured media, theme palette, typography, and resources without editing raw Channel JS or CSS.</p>

        <div class="btfw-filter-status" data-role="filter-status" data-state="checking">
          <div class="btfw-filter-status__row">
            <span class="btfw-filter-status__dot" aria-hidden="true"></span>
            <div class="btfw-filter-status__text">
              <strong>BillTube chat filters</strong>
              <span data-role="filter-status-message">Checking channel filters&hellip;</span>
            </div>
            <div class="btfw-filter-status__actions">
              <button type="button" class="btfw-filter-status__btn" data-role="filter-status-open" hidden>Open chat filters</button>
              <button type="button" class="btfw-filter-status__btn is-ghost" data-role="filter-status-refresh">Re-check</button>
            </div>
          </div>
          <p class="btfw-filter-status__note" data-role="filter-status-note" hidden></p>
        </div>

        <div class="btfw-admin-layout">
          <nav class="btfw-admin-nav" data-role="admin-nav" aria-label="Toolkit sections"></nav>
          <div class="btfw-admin-panes" data-role="admin-panes">

        <details class="section" data-section="resources">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Featured Content & Resources</h4>
              <span>Manage the featured slider feed and extra theme assets.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label class="btfw-checkbox" for="btfw-theme-slider-enabled">
                <input type="checkbox" id="btfw-theme-slider-enabled" data-btfw-bind="slider.enabled">
                <span>Enable featured slider</span>
              </label>
              <p class="help">Toggles the channel list carousel by setting <code>UI_ChannelList</code> in Channel JS.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-slider-json">Featured slider JSON</label>
              <input type="url" id="btfw-theme-slider-json" data-btfw-bind="slider.feedUrl" placeholder="https://example.com/featured.json">
              <p class="help">Paste the URL to the JSON feed used by the channel slider.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-css-urls">Additional CSS URLs</label>
              <textarea id="btfw-theme-css-urls" data-btfw-bind="resources.styles" placeholder="https://example.com/theme.css"></textarea>
              <p class="help">Each line becomes a stylesheet link injected before the theme renders.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-js-urls">Additional Script URLs</label>
              <textarea id="btfw-theme-js-urls" data-btfw-bind="resources.scripts" placeholder="https://example.com/widget.js"></textarea>
              <p class="help">Each line becomes a deferred script tag for optional widgets or behavior.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-module-0">Additional module URLs</label>
              <div class="module-inputs" data-role="module-inputs">
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-0" name="btfw-theme-module-0" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-1" name="btfw-theme-module-1" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
                <div class="module-input__row">
                  <input type="url" id="btfw-theme-module-2" name="btfw-theme-module-2" class="module-input__control" placeholder="https://example.com/module.js" data-role="module-input">
                </div>
              </div>
              <p class="help">Load up to 10 extra BillTube modules by URL. A new field appears once you fill the last one.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="event">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Event Countdown</h4>
              <span>Show every viewer a live countdown to your next scheduled event.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label class="btfw-checkbox" for="btfw-theme-event-enabled">
                <input type="checkbox" id="btfw-theme-event-enabled" data-btfw-bind="event.enabled">
                <span>Show countdown banner</span>
              </label>
              <p class="help">A banner under the video counts down to the event and switches to LIVE at start time (it hides six hours after).</p>
            </div>
            <div class="field">
              <label for="btfw-theme-event-title">Event title</label>
              <input type="text" id="btfw-theme-event-title" data-btfw-bind="event.title" maxlength="80" placeholder="Halloween Marathon">
            </div>
            <div class="field">
              <label for="btfw-theme-event-start">Starts at</label>
              <input type="datetime-local" id="btfw-theme-event-start" data-btfw-bind="event.startsAtLocal">
              <p class="help">Enter the time in <strong>your</strong> timezone — every viewer sees the countdown and date converted to theirs.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="integrations">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Integrations</h4>
              <span>Connect API keys used by chat tools and commands.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="integrations-callout">
              <strong>TMDB API key</strong>
              <span>Required for the <code>!summary</code> command to fetch movie metadata. Request a key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org</a>.</span>
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-tmdb">TMDB API key</label>
              <input type="text" id="btfw-theme-integrations-tmdb" data-btfw-bind="integrations.tmdb.apiKey" placeholder="YOUR_TMDB_KEY">
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-klipy">Klipy API key (GIFs)</label>
              <input type="text" id="btfw-theme-integrations-klipy" data-btfw-bind="integrations.klipy.apiKey" placeholder="YOUR_KLIPY_KEY">
              <p class="help">Used by the GIF picker after the Tenor API shutdown. Request a key at <a href="https://klipy.com/developers" target="_blank" rel="noopener">klipy.com/developers</a>.</p>
            </div>
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-movie-info-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Movie info overlay</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <input type="checkbox" id="btfw-theme-movie-info-enabled" data-btfw-bind="integrations.movieInfo.enabled" hidden>
              <p class="help is-warning" data-role="movie-info-requirements" hidden>Requires a TMDB API key. Add the key above before enabling to avoid empty results.</p>
            </div>
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-movie-poll-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Movie poll posters</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <input type="checkbox" id="btfw-theme-movie-poll-enabled" data-btfw-bind="moviePoll.enabled" hidden>
              <p class="help is-warning" data-role="movie-poll-requirements" hidden>Requires a TMDB API key (used to fetch posters &amp; ratings).</p>
              <p class="help">Turns CyTube polls whose options are movie titles into poster cards with TMDB ratings &amp; genres. Loads on channel join only when enabled.</p>
            </div>
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-auto-subs-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Auto subtitles</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <input type="checkbox" id="btfw-theme-auto-subs-enabled" data-btfw-bind="integrations.autoSubs.enabled" hidden>
              <p class="help is-warning" data-role="auto-subs-requirements" hidden>Requires a TMDB API key before enabling.</p>
              <p class="help">Pulls English subtitles for direct file uploads from the optional sources below (Wyzie and/or SubDL), with a community Stremio addon as a keyless fallback.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-wyzie">Wyzie API key (optional)</label>
              <div class="key-test-row">
                <input type="text" id="btfw-theme-integrations-wyzie" data-btfw-bind="integrations.wyzie.apiKey" placeholder="YOUR_WYZIE_KEY">
                <button type="button" class="btn-secondary" id="btfw-theme-integrations-wyzie-test">Test key</button>
              </div>
              <p class="help" data-role="wyzie-test-result" hidden></p>
              <p class="help">Claim a free key at <a href="https://store.wyzie.io/redeem" target="_blank" rel="noopener">store.wyzie.io/redeem</a>.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-subdl">SubDL API key (optional)</label>
              <div class="key-test-row">
                <input type="text" id="btfw-theme-integrations-subdl" data-btfw-bind="integrations.subdl.apiKey" placeholder="YOUR_SUBDL_KEY">
                <button type="button" class="btn-secondary" id="btfw-theme-integrations-subdl-test">Test key</button>
              </div>
              <p class="help" data-role="subdl-test-result" hidden></p>
              <p class="help">A second optional source, searched in-browser. Claim a free key at <a href="https://subdl.com/panel/api" target="_blank" rel="noopener">subdl.com/panel/api</a>.</p>
            </div>
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-audio-enhancer-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Audio enhancer (boost & normalization)</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <input type="checkbox" id="btfw-theme-audio-enhancer-enabled" data-btfw-bind="integrations.audioEnhancer.enabled" hidden>
              <p class="help">Makes the boost and normalization controls available in the viewer toolkit. Leave disabled to hide them.</p>
            </div>
            <div class="integrations-callout">
              <strong>Ratings API endpoint</strong>
              <span>Point to your BillTube Worker that stores community ratings for now playing media.</span>
            </div>
            <div class="field">
              <label for="btfw-theme-integrations-ratings">Ratings API endpoint</label>
              <input type="url" id="btfw-theme-integrations-ratings" data-btfw-bind="integrations.ratings.endpoint" placeholder="https://billtubemovierating.billtube.workers.dev/">
              <p class="help">Leave blank to disable the rating widget entirely.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="playlistCatalogue">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Playlist Catalogue</h4>
              <span>Publish the current playlist as a searchable public TMDB movie list.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label class="btfw-checkbox" for="btfw-playlist-catalog-enabled">
                <input type="checkbox" id="btfw-playlist-catalog-enabled" data-btfw-bind="playlistCatalog.enabled">
                <span>Enable public Movies catalogue</span>
              </label>
              <p class="help">Guests can browse the synced TMDB list even when the CyTube playlist itself is hidden.</p>
            </div>
            <div class="field">
              <label for="btfw-playlist-catalog-url">Public TMDB list URL</label>
              <input type="url" id="btfw-playlist-catalog-url" data-btfw-bind="playlistCatalog.tmdbListUrl" placeholder="https://www.themoviedb.org/list/123456">
              <p class="help">This public URL is the only catalogue identifier stored in Channel JS.</p>
            </div>
            <div class="field" data-role="playlist-catalog-token-field">
              <label>Connect TMDB for syncing</label>
              <div class="key-test-row">
                <button type="button" class="btn-secondary" id="btfw-playlist-catalog-connect" aria-busy="false"><span class="btfw-inline-spinner" aria-hidden="true"></span><span data-role="playlist-catalog-connect-label">Sign in with TMDB</span></button>
                <button type="button" class="btn-secondary btfw-control-hidden" id="btfw-playlist-catalog-disconnect" hidden>Disconnect TMDB</button>
              </div>
              <p class="help" id="btfw-playlist-catalog-connection-status" data-variant="idle" aria-live="polite">Sign in to connect a TMDB account. The local session is verified before syncing is enabled.</p>
            </div>
            <div class="field btfw-control-hidden" data-role="playlist-catalog-sync-actions" hidden>
              <label for="btfw-playlist-catalog-list-picker">Your TMDB lists</label>
              <div class="key-test-row">
                <select id="btfw-playlist-catalog-list-picker" aria-label="Choose a TMDB list"><option value="">Loading your TMDB lists…</option></select>
                <button type="button" class="btn-secondary" id="btfw-playlist-catalog-refresh-lists">Refresh</button>
              </div>
              <p class="help">Choose an existing list to sync, or create a new public list below. Choosing a list updates the draft URL; click Apply to publish it for viewers.</p>
              <div class="buttons" style="margin:0;">
                <button type="button" class="btn-secondary" id="btfw-playlist-catalog-create">Create a new TMDB list</button>
                <button type="button" class="btn-primary" id="btfw-playlist-catalog-sync">Sync current playlist</button>
              </div>
              <p class="help" id="btfw-playlist-catalog-status" data-variant="idle" aria-live="polite"><span data-role="playlist-catalog-status-text">Sign in with TMDB before creating or syncing a list.</span><span class="btfw-inline-spinner btfw-status-spinner" aria-hidden="true"></span></p>
            </div>
          </div>
        </details>

        <details class="section" data-section="emoteMarketplace">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Emote Marketplace</h4>
              <span>Add emote packs from 7TV, BetterTTV, or emoji.gg. They appear as extra tabs in the chat emote picker.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <p class="help"><strong>Requires the BillTube chat filters</strong> — open Chat Filters and click <em>Import Required BillTube Chat Filters</em> once, or pack emotes won't render in chat.</p>
            <div class="btfw-emote-mkt">
              <div class="btfw-emote-mkt__form">
                <div class="field">
                  <label for="btfw-emote-mkt-provider">Provider</label>
                  <select id="btfw-emote-mkt-provider">
                    <option value="7tv">7TV — emote set</option>
                    <option value="bttv">BetterTTV — channel / global</option>
                    <option value="ffz">FrankerFaceZ — channel / global</option>
                    <option value="egg">emoji.gg — pack</option>
                  </select>
                </div>
                <div class="field">
                  <label for="btfw-emote-mkt-id" data-role="id-label">7TV set URL or ID</label>
                  <input type="text" id="btfw-emote-mkt-id" placeholder="https://7tv.app/emote-sets/01F6…">
                  <p class="help" data-role="id-hint">Browse emotes on <a href="https://7tv.app/emotes" target="_blank" rel="noopener">7tv.app</a>, open a set, and paste its URL (looks like <code>7tv.app/emote-sets/…</code>).</p>
                </div>
                <div class="field">
                  <label for="btfw-emote-mkt-label">Tab name (optional)</label>
                  <input type="text" id="btfw-emote-mkt-label" placeholder="Defaults to the pack's own name">
                </div>
                <div class="btfw-emote-mkt__preview" data-role="emote-mkt-preview" hidden></div>
                <div class="btfw-emote-mkt__actions-row">
                  <button type="button" class="btfw-mkt-btn" id="btfw-emote-mkt-preview-btn">Preview</button>
                  <button type="button" class="btfw-mkt-btn btfw-mkt-btn--primary" id="btfw-emote-mkt-add">Add pack</button>
                </div>
                <p class="help" data-role="emote-mkt-result" hidden></p>
              </div>
              <div class="btfw-emote-mkt__list" id="btfw-emote-mkt-list" data-role="emote-pack-list"></div>
            </div>
          </div>
        </details>

        <details class="section" data-section="palette">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Palette & Tint</h4>
              <span>Adjust surface colors and accent tint.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-tint">Preset tint</label>
              <select id="btfw-theme-tint" data-btfw-bind="tint">
                <optgroup label="Curated">
                  <option value="midnight">Graphite</option>
                  <option value="aurora">Slate</option>
                  <option value="mocha">Mocha</option>
                  <option value="ember">Amber</option>
                  <option value="sunset">Blush</option>
                  <option value="citron">Citron</option>
                </optgroup>
                <optgroup label="Themed">
                  <option value="cyberpunk">Cyberpunk 2077</option>
                  <option value="synthwave">Synthwave Sunset</option>
                  <option value="matrix">Matrix Terminal</option>
                  <option value="vaporwave">Vaporwave Dream</option>
                  <option value="bloodMoon">Blood Moon</option>
                  <option value="crimsonNoir">Crimson Noir</option>
                  <option value="forestGold">Forest &amp; Gold</option>
                </optgroup>
                <optgroup label="Editor">
                  <option value="dracula">Dracula</option>
                  <option value="tokyoNight">Tokyo Night</option>
                  <option value="nord">Nord Frost</option>
                </optgroup>
                <option value="custom">Custom mix</option>
              </select>
              <p class="help">Choose a palette, then fine-tune any swatch. Surface, Panel, and Accent automatically blend into the card gradients, matching borders, and soft glow.</p>
            </div>
            <div class="btfw-palette__swatches">
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.background"><span class="btfw-swatch__name">Background</span><span class="btfw-swatch__hex" data-hex="background"></span></label>
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.surface"><span class="btfw-swatch__name">Surface</span><span class="btfw-swatch__hex" data-hex="surface"></span></label>
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.panel"><span class="btfw-swatch__name">Panel</span><span class="btfw-swatch__hex" data-hex="panel"></span></label>
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.text"><span class="btfw-swatch__name">Primary text</span><span class="btfw-swatch__hex" data-hex="text"></span></label>
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.chatText"><span class="btfw-swatch__name">Chat text</span><span class="btfw-swatch__hex" data-hex="chatText"></span></label>
              <label class="btfw-swatch"><input type="color" data-btfw-bind="colors.accent"><span class="btfw-swatch__name">Accent</span><span class="btfw-swatch__hex" data-hex="accent"></span></label>
            </div>
            <div class="btfw-gradient-studio">
              <div class="field btfw-switch-field">
                <button type="button" class="btfw-switch" id="btfw-theme-gradient-toggle" role="switch" aria-pressed="false" aria-controls="btfw-gradient-editor">
                  <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                  <span class="btfw-switch__meta">
                    <span class="btfw-switch__title">Gradient Studio</span>
                    <span class="btfw-switch__state" data-role="state-label">Off</span>
                  </span>
                </button>
                <input type="checkbox" id="btfw-theme-gradient-enabled" data-btfw-bind="gradient.enabled" hidden>
              </div>
              <div class="btfw-gradient-editor" id="btfw-gradient-editor" data-role="gradient-editor-fields" hidden>
                <div class="btfw-gradient-lead">
                  <p class="help">Build a four-color path, then choose where it appears. Follow palette keeps the blend synced with every preset and swatch edit.</p>
                  <button type="button" class="btfw-gradient-reset" id="btfw-gradient-reset">Reset path</button>
                </div>
                <div class="field">
                  <label for="btfw-gradient-source">Colours</label>
                  <select id="btfw-gradient-source" data-btfw-bind="gradient.source">
                    <option value="palette">Follow palette</option>
                    <option value="custom">Custom colours</option>
                  </select>
                </div>
                <input type="hidden" id="btfw-gradient-type" data-btfw-bind="gradient.type">
                <div class="btfw-gradient-type-grid" role="tablist" aria-label="Gradient style">
                  <button type="button" class="btfw-gradient-type" role="tab" data-gradient-type="flow"><span class="btfw-gradient-type__preview"></span><span>Flow</span></button>
                  <button type="button" class="btfw-gradient-type" role="tab" data-gradient-type="linear"><span class="btfw-gradient-type__preview"></span><span>Linear</span></button>
                  <button type="button" class="btfw-gradient-type" role="tab" data-gradient-type="retro"><span class="btfw-gradient-type__preview"></span><span>Retro</span></button>
                  <button type="button" class="btfw-gradient-type" role="tab" data-gradient-type="pixel"><span class="btfw-gradient-type__preview"></span><span>Pixel</span></button>
                </div>
                <div class="btfw-gradient-stage" data-role="gradient-stage" aria-label="Live gradient preview">
                  <div class="btfw-gradient-stage__visual" data-role="gradient-stage-visual"></div>
                  <span class="btfw-gradient-stage__badge" data-role="gradient-stage-label">Flow · animated</span>
                </div>
                <div class="btfw-gradient-balance-label"><strong>Colour balance</strong><span class="help">Four bands</span></div>
                <div class="btfw-gradient-balance" data-role="gradient-balance" role="group" aria-label="Colour balance">
                  <span class="btfw-gradient-balance__active" data-role="gradient-active-band"></span>
                  <button type="button" class="btfw-gradient-balance__handle" data-balance-index="0" role="slider" aria-label="Balance between colour 1 and 2" aria-valuemin="6" aria-valuemax="82" aria-valuenow="25"></button>
                  <button type="button" class="btfw-gradient-balance__handle" data-balance-index="1" role="slider" aria-label="Balance between colour 2 and 3" aria-valuemin="12" aria-valuemax="88" aria-valuenow="50"></button>
                  <button type="button" class="btfw-gradient-balance__handle" data-balance-index="2" role="slider" aria-label="Balance between colour 3 and 4" aria-valuemin="18" aria-valuemax="94" aria-valuenow="75"></button>
                </div>
                <p class="btfw-gradient-balance-hint">Drag the grabbers to set how much each colour spreads · tap a band to pick it</p>
                <div class="btfw-gradient-stops">
                  <label class="btfw-gradient-stop" data-stop-index="0">
                    <input type="color" data-btfw-bind="gradient.stops.0.color" data-role="gradient-stop-color">
                    <span class="btfw-gradient-stop__title" data-role="gradient-stop-name">Background</span>
                    <span class="btfw-gradient-stop__meta">Colour 1</span>
                  </label>
                  <label class="btfw-gradient-stop" data-stop-index="1">
                    <input type="color" data-btfw-bind="gradient.stops.1.color" data-role="gradient-stop-color">
                    <span class="btfw-gradient-stop__title" data-role="gradient-stop-name">Surface</span>
                    <span class="btfw-gradient-stop__meta">Colour 2</span>
                  </label>
                  <label class="btfw-gradient-stop" data-stop-index="2">
                    <input type="color" data-btfw-bind="gradient.stops.2.color" data-role="gradient-stop-color">
                    <span class="btfw-gradient-stop__title" data-role="gradient-stop-name">Panel</span>
                    <span class="btfw-gradient-stop__meta">Colour 3</span>
                  </label>
                  <label class="btfw-gradient-stop" data-stop-index="3">
                    <input type="color" data-btfw-bind="gradient.stops.3.color" data-role="gradient-stop-color">
                    <span class="btfw-gradient-stop__title" data-role="gradient-stop-name">Accent</span>
                    <span class="btfw-gradient-stop__meta">Colour 4</span>
                  </label>
                </div>
                <div class="btfw-gradient-controls">
                  <div class="field" data-role="gradient-angle-field">
                    <label for="btfw-gradient-angle">Angle</label>
                    <div class="btfw-gradient-range"><input type="range" id="btfw-gradient-angle" min="0" max="360" step="1" data-btfw-bind="gradient.angle"><output data-role="gradient-angle-value">135°</output></div>
                  </div>
                  <div class="field">
                    <label for="btfw-gradient-strength">Blend strength</label>
                    <div class="btfw-gradient-range"><input type="range" id="btfw-gradient-strength" min="20" max="72" step="1" data-btfw-bind="gradient.strength"><output data-role="gradient-strength-value">34%</output></div>
                  </div>
                  <div class="field">
                    <label for="btfw-gradient-motion">Motion</label>
                    <select id="btfw-gradient-motion" data-btfw-bind="gradient.motion">
                      <option value="off">Static</option>
                      <option value="slow">Slow</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>
                </div>
                <div class="btfw-gradient-balance-label" style="margin-top:12px"><strong>Finish</strong><span class="help">Texture and diffusion</span></div>
                <div class="btfw-gradient-controls btfw-gradient-controls--finish">
                  <div class="field">
                    <label for="btfw-gradient-soften">Soften</label>
                    <div class="btfw-gradient-range"><input type="range" id="btfw-gradient-soften" min="0" max="80" step="1" data-btfw-bind="gradient.soften"><output data-role="gradient-soften-value">18px</output></div>
                  </div>
                  <div class="field">
                    <label for="btfw-gradient-noise">Noise</label>
                    <div class="btfw-gradient-range"><input type="range" id="btfw-gradient-noise" min="0" max="100" step="1" data-btfw-bind="gradient.noise"><output data-role="gradient-noise-value">8%</output></div>
                  </div>
                </div>
                <div class="btfw-gradient-targets" role="group" aria-label="Gradient targets">
                  <label class="btfw-gradient-target"><input type="checkbox" data-btfw-bind="gradient.targets.page"> Page wash</label>
                  <label class="btfw-gradient-target"><input type="checkbox" data-btfw-bind="gradient.targets.panels"> Panels &amp; stacks</label>
                  <label class="btfw-gradient-target"><input type="checkbox" data-btfw-bind="gradient.targets.navbar"> Navbar</label>
                </div>
                <p class="help" style="margin-top:9px">Flow, Retro, Pixel, and iOS animate when motion is enabled. Reduced-motion preferences are always respected.</p>
              </div>
            </div>
            <div class="field">
              <label>Background pattern</label>
              <input type="hidden" data-btfw-bind="background.pattern" data-role="pattern-input">
              <div class="btfw-pattern-grid" data-role="pattern-grid" role="radiogroup" aria-label="Background pattern" aria-orientation="horizontal" aria-describedby="btfw-pattern-help"></div>
              <div class="btfw-pattern-intensity" data-role="pattern-intensity-row" hidden>
                <label for="btfw-theme-pattern-intensity">Intensity</label>
                <select id="btfw-theme-pattern-intensity" data-btfw-bind="background.intensity">
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
              <p class="help" id="btfw-pattern-help">Drag horizontally or use the arrow keys. Patterns use your Background and Accent colors (Hero Patterns); choose None for a flat background.</p>
            </div>
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-dither-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Dither surface material</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <input type="checkbox" id="btfw-theme-dither-enabled" data-btfw-bind="material.dither" hidden>
              <div class="btfw-pattern-intensity" data-role="dither-intensity-row" hidden>
                <label for="btfw-theme-dither-intensity">Intensity</label>
                <select id="btfw-theme-dither-intensity" data-btfw-bind="material.ditherIntensity">
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
              <p class="help">Adds a static, Accent-colored dot matrix to page washes, cards, modals, and buttons. Video, posters, emotes, profile images, inputs, and chat text remain untouched.</p>
            </div>
            <div class="preview btfw-tp" data-role="theme-preview" aria-hidden="true">
              <div class="btfw-tp__bar"><span class="btfw-tp__dot"></span><span class="btfw-tp__dot"></span><span class="btfw-tp__dot"></span><span class="btfw-tp__barlabel">Live preview</span></div>
              <div class="btfw-tp__body">
                <div class="btfw-tp__panel">
                  <div class="btfw-tp__heading">Primary text heading</div>
                  <div class="btfw-tp__sub">The quick brown fox jumps over the lazy dog.</div>
                  <button type="button" class="btfw-tp__btn">Accent button</button>
                </div>
                <div class="btfw-tp__chat">
                  <div class="btfw-tp__msg"><b class="btfw-tp__user">Nova</b>the theme looks great in here</div>
                  <div class="btfw-tp__msg"><b class="btfw-tp__user">Vex</b>chat text reads cleanly</div>
                </div>
              </div>
            </div>
          </div>
        </details>

        <details class="section" data-section="typography">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Typography</h4>
              <span>Select the base font used across the theme.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-font">Font preset</label>
              <select id="btfw-theme-font" data-btfw-bind="typography.preset">
                <option value="inter">Inter</option>
                <option value="roboto">Roboto</option>
                <option value="poppins">Poppins</option>
                <option value="montserrat">Montserrat</option>
                <option value="opensans">Open Sans</option>
                <option value="lato">Lato</option>
                <option value="nunito">Nunito</option>
                <option value="manrope">Manrope</option>
                <option value="outfit">Outfit</option>
                <option value="urbanist">Urbanist</option>
                <option value="custom">Custom Google Font</option>
              </select>
              <p class="help">Curated Google Fonts optimized for readability. Choose <em>Custom</em> to specify your own.</p>
            </div>
            <div class="field" id="btfw-theme-font-custom-field">
              <label for="btfw-theme-font-custom">Custom Google font name</label>
              <input type="text" id="btfw-theme-font-custom" data-btfw-bind="typography.customFamily" placeholder="Space Grotesk">
              <p class="help">Enter the exact family name from Google Fonts. We load weights 300, 400, 600, and 700 automatically.</p>
            </div>
            <div class="preview preview--font" aria-hidden="true">
              <div class="preview__font-label" data-role="font-name">Inter</div>
              <p class="preview__font-text" data-role="font-sample">The quick brown fox jumps over the lazy dog.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="branding">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Branding</h4>
              <span>Navbar title, favicon, and poster overrides.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field">
              <label for="btfw-theme-header-name">Channel header name</label>
              <input type="text" id="btfw-theme-header-name" data-btfw-bind="branding.headerName" placeholder="CyTube">
              <p class="help">Replaces the navbar brand text for all visitors.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-favicon">Favicon URL</label>
              <input type="url" id="btfw-theme-favicon" data-btfw-bind="branding.faviconUrl" placeholder="https://example.com/favicon.png">
              <p class="help">Provide a full URL to the icon browsers should show in the tab bar.</p>
            </div>
            <div class="field">
              <label for="btfw-theme-poster">Video poster URL</label>
              <input type="url" id="btfw-theme-poster" data-btfw-bind="branding.posterUrl" placeholder="https://example.com/poster.jpg">
              <p class="help">Optional hero image used by some overlays. Leave blank to use the default poster.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="developer">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Developer</h4>
              <span>Toggles for iterating on the theme. Defaults match a polished live channel.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="field btfw-switch-field">
              <button type="button" class="btfw-switch" id="btfw-theme-dev-nocache-toggle" role="switch" aria-pressed="false">
                <span class="btfw-switch__track" aria-hidden="true"><span class="btfw-switch__knob"></span></span>
                <span class="btfw-switch__meta">
                  <span class="btfw-switch__title">Development mode (cache-bust every load)</span>
                  <span class="btfw-switch__state" data-role="state-label">Off</span>
                </span>
              </button>
              <p class="help">When <strong>on</strong>, every CSS / module URL gets a unique <code>?t=&lt;ms&gt;</code> appended so you see code changes immediately on reload. When <strong>off</strong> (recommended for live channels), URLs stay stable so the CDN and browser caches kick in — viewers get faster reloads and only pay for fetches when you actually ship a new commit. Setting is per-browser; reload the page to apply.</p>
            </div>
          </div>
        </details>

        <details class="section" data-section="backup">
          <summary class="section__summary">
            <div class="section__title">
              <h4>Backup &amp; Restore</h4>
              <span>Export the full toolkit configuration to a file, or restore one.</span>
            </div>
            <span class="section__chevron" aria-hidden="true">›</span>
          </summary>
          <div class="section__body">
            <div class="btfw-backup-actions">
              <button type="button" class="btfw-btn btfw-btn--primary btfw-btn--sm" data-role="backup-export">Download backup</button>
              <button type="button" class="btfw-btn btfw-btn--sm" data-role="backup-import">Import backup&hellip;</button>
              <input type="file" accept=".json,application/json" data-role="backup-file" hidden>
            </div>
            <p class="help" data-role="backup-status">The backup contains every toolkit setting, including API keys — keep the file private. Backups from older theme versions are upgraded automatically on import; review the panel and click Apply to publish.</p>
          </div>
        </details>

          </div>
        </div>

        <div class="buttons btfw-admin-actions">
          <button type="button" class="btn-primary" id="btfw-theme-apply">Apply to Channel CSS &amp; JS</button>
          <button type="button" class="btn-secondary" id="btfw-theme-reset">Reset to preset</button>
          <span class="status" id="btfw-theme-status" data-variant="idle">No changes applied yet.</span>
        </div>
      </div>
    `;
    return panel;
  }

  function canManagePlaylistCatalog(){
    const rank = Number(window.CLIENT?.rank);
    return Number.isFinite(rank) && rank >= 3;
  }

  function wirePlaylistCatalogControls(panel, cfg, onChange){
    const connect = panel.querySelector('#btfw-playlist-catalog-connect');
    const forget = panel.querySelector('#btfw-playlist-catalog-disconnect');
    const create = panel.querySelector('#btfw-playlist-catalog-create');
    const sync = panel.querySelector('#btfw-playlist-catalog-sync');
    const listPicker = panel.querySelector('#btfw-playlist-catalog-list-picker');
    const refreshLists = panel.querySelector('#btfw-playlist-catalog-refresh-lists');
    const syncActions = panel.querySelector('[data-role="playlist-catalog-sync-actions"]');
    const urlInput = panel.querySelector('#btfw-playlist-catalog-url');
    const enabledInput = panel.querySelector('#btfw-playlist-catalog-enabled');
    const status = panel.querySelector('#btfw-playlist-catalog-status');
    const statusText = status?.querySelector('[data-role="playlist-catalog-status-text"]');
    const connectionStatus = panel.querySelector('#btfw-playlist-catalog-connection-status');
    const connectLabel = connect?.querySelector('[data-role="playlist-catalog-connect-label"]');
    const controls = [connect, forget, create, sync, listPicker, refreshLists, urlInput, enabledInput].filter(Boolean);
    const setStatus = (text, variant = 'idle') => {
      if (!status) return;
      if (statusText) statusText.textContent = text;
      else status.textContent = text;
      status.dataset.variant = variant;
    };
    const formatRemaining = milliseconds => {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    };
    const renderSyncProgress = (progress, startedAt, progressState) => {
      if (progressState.phase !== progress.phase) {
        progressState.phase = progress.phase;
        progressState.startedAt = Date.now();
      }
      const elapsed = Date.now() - (progressState.startedAt || startedAt);
      const sourceTotal = Number(progress.sourceTotal || 0);
      if (progress.phase === 'matching') {
        const completed = Math.min(sourceTotal, Number(progress.current || 0) + Number(progress.duplicateSources || 0));
        const eta = completed > 0 && completed < sourceTotal ? ` · about ${formatRemaining(elapsed / completed * (sourceTotal - completed))} left` : '';
        setStatus(`Matching movies: ${completed}/${sourceTotal}${eta}`, 'pending');
      } else if (progress.phase === 'updating') {
        const totalUpdates = Number(progress.total || 0);
        const eta = totalUpdates && progress.current > 0 && progress.current < totalUpdates ? ` · about ${formatRemaining(elapsed / progress.current * (totalUpdates - progress.current))} left` : '';
        const updateText = totalUpdates ? `${progress.current}/${totalUpdates} TMDB changes${eta}` : 'no TMDB changes needed';
        setStatus(`Matched ${progress.matched || 0}/${sourceTotal} movies · ${updateText}`, 'pending');
      } else if (progress.phase === 'preparing') {
        setStatus(`Preparing full playlist: 0/${sourceTotal}`, 'pending');
      }
    };
    const setConnectionStatus = (text, variant = 'idle') => {
      if (!connectionStatus) return;
      connectionStatus.textContent = text;
      connectionStatus.dataset.variant = variant;
      connectionStatus.classList.toggle('is-success', variant === 'saved');
      connectionStatus.classList.toggle('is-error', variant === 'error');
      connectionStatus.classList.toggle('is-pending', variant === 'pending');
    };
    const api = () => window.BTFW_PlaylistCatalog;
    const allowed = canManagePlaylistCatalog();
    let listsLoading = false;
    const loadAccountLists = async ({ selectedUrl = '', announce = true } = {}) => {
      if (listsLoading) return;
      try {
        if (!api()?.getAccountLists) throw new Error('TMDB list retrieval is still loading. Try again shortly.');
        listsLoading = true;
        if (refreshLists) { refreshLists.disabled = true; refreshLists.textContent = 'Loading…'; }
        if (listPicker) { listPicker.disabled = true; listPicker.innerHTML = '<option value="">Loading your TMDB lists…</option>'; }
        if (announce) setStatus('Retrieving your TMDB lists…', 'pending');
        const lists = await api().getAccountLists();
        if (listPicker) {
          listPicker.innerHTML = '';
          const placeholder = document.createElement('option');
          placeholder.value = ''; placeholder.textContent = lists.length ? 'Choose a TMDB list…' : 'No TMDB lists found yet';
          listPicker.appendChild(placeholder);
          lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.url;
            option.textContent = `${list.name} (${list.itemCount} ${list.itemCount === 1 ? 'movie' : 'movies'})`;
            option.title = list.description || list.url;
            listPicker.appendChild(option);
          });
          const currentUrl = selectedUrl || urlInput?.value?.trim() || '';
          if ([...listPicker.options].some(option => option.value === currentUrl)) listPicker.value = currentUrl;
          listPicker.disabled = false;
        }
        if (announce) setStatus(lists.length ? `Found ${lists.length} TMDB list${lists.length === 1 ? '' : 's'}. Choose one to sync, or create a new list.` : 'No TMDB lists found. Create a new list to get started.', 'saved');
      } catch (error) {
        if (listPicker) { listPicker.innerHTML = '<option value="">Unable to load TMDB lists</option>'; listPicker.disabled = true; }
        if (announce) setStatus(error?.message || 'Unable to retrieve TMDB lists.', 'error');
      } finally {
        listsLoading = false;
        if (refreshLists) { refreshLists.disabled = false; refreshLists.textContent = 'Refresh'; }
      }
    };
    const setConnectionState = (state, message) => {
      const connected = state === 'connected';
      const waiting = state === 'checking' || state === 'pending';
      if (connect) {
        connect.hidden = connected;
        connect.disabled = !allowed || waiting;
        connect.classList.toggle('is-loading', waiting);
        connect.setAttribute('aria-busy', waiting ? 'true' : 'false');
      }
      if (connectLabel) connectLabel.textContent = waiting ? (state === 'checking' ? 'Checking TMDB…' : 'Waiting for TMDB…') : 'Sign in with TMDB';
      if (forget) { forget.hidden = !connected; forget.classList.toggle('btfw-control-hidden', !connected); forget.disabled = !allowed; }
      if (syncActions) { syncActions.hidden = !connected; syncActions.classList.toggle('btfw-control-hidden', !connected); }
      if (connected) {
        setConnectionStatus('TMDB is connected and verified in this browser.', 'saved');
        setStatus('TMDB is connected. You can now create or sync a list.', 'saved');
        void loadAccountLists({ announce:false });
      } else if (state === 'checking') {
        setConnectionStatus('Checking the saved TMDB session…', 'pending');
      } else if (state === 'pending') {
        setConnectionStatus('Finish signing in and approve access in the TMDB window. This screen will update automatically.', 'pending');
      } else if (state === 'error') {
        setConnectionStatus(message || 'TMDB could not verify this connection. Please sign in again.', 'error');
      } else if (state === 'locked') {
        setConnectionStatus(message || 'Locked: requires native Channel JS edit permission (admin/owner rank) and playlist access.', 'error');
      } else {
        setConnectionStatus(message || 'Sign in to connect a TMDB account. The local session is verified before syncing is enabled.', 'idle');
      }
    };
    controls.forEach(control => { control.disabled = !allowed; });
    if (!allowed) {
      setConnectionState('locked');
      return;
    }
    document.addEventListener('btfw:playlistCatalogAuth', event => {
      if (!panel.isConnected) return;
      const detail = event?.detail || {};
      if (detail.connected) setConnectionState('connected');
      else setConnectionState(detail.reason ? 'error' : 'signedOut', detail.reason);
    });
    const verifySavedSession = async () => {
      if (!api()?.getWriteSession?.()) { setConnectionState('signedOut'); return; }
      if (!api()?.validateWriteSession) { setConnectionState('error', 'TMDB connection checks are still loading. Please reopen the toolkit.'); return; }
      setConnectionState('checking');
      try {
        const connected = await api().validateWriteSession();
        setConnectionState(connected ? 'connected' : 'signedOut');
      } catch (error) {
        if (panel.isConnected) setConnectionState('error', error?.message || 'TMDB could not verify the saved session. Sign in again.');
      }
    };
    void verifySavedSession();
    if (connect) connect.addEventListener('click', async () => {
      setConnectionState('pending');
      try {
        if (!api()?.beginTmdbSignIn) throw new Error('Playlist catalogue module is still loading. Try again shortly.');
        await api().beginTmdbSignIn();
      } catch (error) { setConnectionState('error', error?.message || 'Unable to start TMDB sign-in.'); }
    });
    if (forget) forget.addEventListener('click', () => {
      api()?.clearWriteToken?.();
      setConnectionState('signedOut', 'TMDB was disconnected from this browser.');
    });
    if (refreshLists) refreshLists.addEventListener('click', () => { void loadAccountLists(); });
    if (listPicker) listPicker.addEventListener('change', () => {
      const listUrl = listPicker.value;
      if (!listUrl) return;
      if (urlInput) urlInput.value = listUrl;
      cfg.playlistCatalog = cfg.playlistCatalog || {};
      cfg.playlistCatalog.tmdbListUrl = listUrl;
      onChange();
      setStatus('Selected TMDB list. Click Apply to publish its URL, then sync the playlist.', 'saved');
    });
    if (create) create.addEventListener('click', async () => {
      try {
        if (!api()?.createList) throw new Error('Playlist catalogue module is still loading. Try again shortly.');
        create.disabled = true; setStatus('Creating public TMDB list…', 'pending');
        const listUrl = await api().createList();
        if (urlInput) urlInput.value = listUrl;
        cfg.playlistCatalog = cfg.playlistCatalog || {};
        cfg.playlistCatalog.tmdbListUrl = listUrl;
        cfg.playlistCatalog.enabled = true;
        if (enabledInput) enabledInput.checked = true;
        onChange();
        void loadAccountLists({ selectedUrl:listUrl, announce:false });
        setStatus('TMDB list created. Click Apply to publish its URL, then sync the playlist.', 'saved');
      } catch (error) { setStatus(error?.message || 'Unable to create the TMDB list.', 'error'); }
      finally { create.disabled = false; }
    });
    if (sync) sync.addEventListener('click', async () => {
      try {
        if (!api()?.sync) throw new Error('Playlist catalogue module is still loading. Try again shortly.');
        const existingUrl = urlInput?.value?.trim() || '';
        const confirmKey = `btfw:tmdb:list-confirmed:${String(window.CHANNEL?.name || '').toLowerCase()}:${existingUrl}`;
        if (existingUrl && !sessionStorage.getItem(confirmKey)) {
          const ok = window.confirm('Syncing reconciles this TMDB list with the current playlist and can remove stale movies. Continue?');
          if (!ok) return;
          sessionStorage.setItem(confirmKey, '1');
        }
        sync.disabled = true;
        const syncStartedAt = Date.now();
        const progressState = { phase:'', startedAt:syncStartedAt };
        setStatus('Preparing full playlist…', 'pending');
        const report = await api().sync({ listUrl: existingUrl, createIfMissing: true, onProgress: progress => renderSyncProgress(progress, syncStartedAt, progressState) });
        if (urlInput && report.listUrl) urlInput.value = report.listUrl;
        cfg.playlistCatalog = cfg.playlistCatalog || {};
        cfg.playlistCatalog.tmdbListUrl = report.listUrl || existingUrl;
        cfg.playlistCatalog.enabled = true;
        if (enabledInput) enabledInput.checked = true;
        onChange();
        setStatus(`Synced: ${report.added} added, ${report.removed} removed, ${report.duplicateSources.length + report.duplicateTmdb.length} duplicates skipped, ${report.skipped.length} unmatched. Click Apply to publish.`, 'saved');
      } catch (error) { setStatus(error?.message || 'Playlist sync failed.', 'error'); }
      finally { sync.disabled = false; }
    });
  }

  function wireGradientStudio(panel, cfg, onChange){
    const typeInput = panel.querySelector("#btfw-gradient-type");
    const typeButtons = [...panel.querySelectorAll("[data-gradient-type]")];
    typeButtons.forEach((button, buttonIndex) => {
      button.addEventListener("click", () => {
        const type = button.dataset.gradientType;
        if (!GRADIENT_TYPES.includes(type)) return;
        normalizeGradientConfig(cfg).type = type;
        if (typeInput) {
          typeInput.value = type;
          typeInput.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          syncGradientEditor(panel, cfg);
          onChange();
        }
      });
      button.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
        const next = typeButtons[(buttonIndex + delta + typeButtons.length) % typeButtons.length];
        next?.focus();
        next?.click();
      });
    });

    const balance = panel.querySelector("[data-role=gradient-balance]");
    if (balance) {
      let draggingIndex = null;
      let renderFrame = 0;
      const queueBalanceRender = () => {
        if (renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = 0;
          syncGradientEditor(panel, cfg);
          onChange();
        });
      };
      const updateBalance = (index, rawValue) => {
        const gradient = normalizeGradientConfig(cfg);
        const lower = index === 0 ? 6 : gradient.balance[index - 1] + 6;
        const upper = index === gradient.balance.length - 1 ? 94 : gradient.balance[index + 1] - 6;
        const value = Math.round(clampGradientNumber(rawValue, lower, upper, gradient.balance[index]));
        if (value === gradient.balance[index]) return;
        gradient.balance[index] = value;
        queueBalanceRender();
      };
      const valueFromPointer = event => {
        const rect = balance.getBoundingClientRect();
        return ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      };

      balance.querySelectorAll("[data-balance-index]").forEach(handle => {
        const index = Number(handle.dataset.balanceIndex);
        handle.addEventListener("pointerdown", event => {
          event.preventDefault();
          draggingIndex = index;
          setActiveGradientBand(panel, index);
          syncGradientEditor(panel, cfg);
          balance.classList.add("is-dragging");
          handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener("pointermove", event => {
          if (draggingIndex !== index) return;
          updateBalance(index, valueFromPointer(event));
        });
        const stopDragging = event => {
          if (draggingIndex !== index) return;
          draggingIndex = null;
          balance.classList.remove("is-dragging");
          handle.releasePointerCapture?.(event.pointerId);
        };
        handle.addEventListener("pointerup", stopDragging);
        handle.addEventListener("pointercancel", stopDragging);
        handle.addEventListener("keydown", event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const gradient = normalizeGradientConfig(cfg);
          const lower = index === 0 ? 6 : gradient.balance[index - 1] + 6;
          const upper = index === gradient.balance.length - 1 ? 94 : gradient.balance[index + 1] - 6;
          const step = event.shiftKey ? 5 : 1;
          const next = event.key === "Home" ? lower
            : event.key === "End" ? upper
              : gradient.balance[index] + (event.key === "ArrowRight" ? step : -step);
          setActiveGradientBand(panel, index);
          updateBalance(index, next);
        });
      });

      balance.addEventListener("click", event => {
        if (event.target.closest("[data-balance-index]")) return;
        const value = valueFromPointer(event);
        const gradient = normalizeGradientConfig(cfg);
        const index = gradient.balance.findIndex(edge => value < edge);
        setActiveGradientBand(panel, index < 0 ? 3 : index);
        syncGradientEditor(panel, cfg);
      });
    }

    panel.querySelectorAll(".btfw-gradient-stop").forEach((card, index) => {
      card.addEventListener("pointerdown", () => {
        setActiveGradientBand(panel, index);
        syncGradientEditor(panel, cfg);
      });
    });
  }
  function watchInputs(panel, cfg, onChange){
    $$('[data-btfw-bind]', panel).forEach(input => {
      const handler = () => {
        if (input.dataset.btfwBind.startsWith("colors")) {
          const tintSelect = panel.querySelector('#btfw-theme-tint');
          if (tintSelect && tintSelect.value !== "custom") {
            tintSelect.value = "custom";
          }
        }
        if (input.id === 'btfw-theme-slider-enabled') {
          updateSliderFieldState(panel);
        }
        if (input.dataset.btfwBind.startsWith("typography")) {
          if (input.id === 'btfw-theme-font-custom') {
            const fontSelect = panel.querySelector('#btfw-theme-font');
            if (fontSelect && fontSelect.value !== 'custom') {
              fontSelect.value = 'custom';
            }
          }
          updateTypographyFieldState(panel);
        }

        onChange();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    });

    const tintSelect = panel.querySelector('#btfw-theme-tint');
    if (tintSelect) {
      tintSelect.addEventListener('change', () => {
        const value = tintSelect.value;
        if (value && value !== 'custom' && TINT_PRESETS[value]) {
          const preset = TINT_PRESETS[value];
          Object.assign(cfg.colors, preset.colors);
          updateInputs(panel, cfg);
        }
        updateTypographyFieldState(panel);
        onChange();
      });
    }

    bindModuleFieldWatcher(panel, onChange);

    const gradientButton = panel.querySelector("#btfw-theme-gradient-toggle");
    const gradientInput = panel.querySelector("#btfw-theme-gradient-enabled");
    if (gradientButton && gradientInput) {
      gradientButton.addEventListener("click", () => {
        const next = !gradientInput.checked;
        gradientInput.checked = next;
        const gradient = normalizeGradientConfig(cfg);
        gradient.enabled = next;
        syncGradientEditor(panel, cfg);
        onChange();
      });
    }

    const gradientReset = panel.querySelector("#btfw-gradient-reset");
    if (gradientReset) {
      gradientReset.addEventListener("click", () => {
        const enabled = normalizeGradientConfig(cfg).enabled;
        cfg.gradient = JSON.parse(JSON.stringify(DEFAULT_CONFIG.gradient));
        cfg.gradient.enabled = enabled;
        updateInputs(panel, cfg);
        onChange();
      });
    }

    wireGradientStudio(panel, cfg, onChange);

    const ditherButton = panel.querySelector('#btfw-theme-dither-toggle');
    const ditherInput = panel.querySelector('#btfw-theme-dither-enabled');
    if (ditherButton && ditherInput) {
      ditherButton.addEventListener('click', () => {
        const next = !ditherInput.checked;
        ditherInput.checked = next;
        if (!cfg.material || typeof cfg.material !== "object") {
          cfg.material = JSON.parse(JSON.stringify(DEFAULT_CONFIG.material));
        }
        cfg.material.dither = next;
        syncDitherToggle(panel, cfg);
        onChange();
      });
    }

    const resetBtn = panel.querySelector('#btfw-theme-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const tint = panel.querySelector('#btfw-theme-tint')?.value || 'midnight';
        if (tint !== 'custom' && TINT_PRESETS[tint]) {
          const preset = TINT_PRESETS[tint];
          Object.assign(cfg.colors, preset.colors);
        } else {
          const defaults = cloneDefaults();
          Object.assign(cfg.colors, defaults.colors);
        }
        updateInputs(panel, cfg);
        onChange();
      });
    }

    const movieInfoButton = panel.querySelector('#btfw-theme-movie-info-toggle');
    const movieInfoInput = panel.querySelector('#btfw-theme-movie-info-enabled');
    if (movieInfoButton && movieInfoInput) {
      movieInfoButton.addEventListener('click', () => {
        const next = !movieInfoInput.checked;
        movieInfoInput.checked = next;
        if (!cfg.integrations || typeof cfg.integrations !== 'object') {
          cfg.integrations = {};
        }
        if (!cfg.integrations.movieInfo || typeof cfg.integrations.movieInfo !== 'object') {
          cfg.integrations.movieInfo = { enabled: false };
        }
        cfg.integrations.movieInfo.enabled = next;
        syncMovieInfoToggle(panel, cfg);
        onChange();
      });
    }

    const moviePollButton = panel.querySelector('#btfw-theme-movie-poll-toggle');
    const moviePollInput = panel.querySelector('#btfw-theme-movie-poll-enabled');
    if (moviePollButton && moviePollInput) {
      moviePollButton.addEventListener('click', () => {
        const next = !moviePollInput.checked;
        moviePollInput.checked = next;
        if (!cfg.moviePoll || typeof cfg.moviePoll !== 'object') cfg.moviePoll = { enabled: false };
        cfg.moviePoll.enabled = next;
        syncMoviePollToggle(panel, cfg);
        onChange();
      });
    }

    const autoSubsButton = panel.querySelector('#btfw-theme-auto-subs-toggle');
    const autoSubsInput = panel.querySelector('#btfw-theme-auto-subs-enabled');
    if (autoSubsButton && autoSubsInput) {
      autoSubsButton.addEventListener('click', () => {
        const next = !autoSubsInput.checked;
        autoSubsInput.checked = next;
        if (!cfg.integrations || typeof cfg.integrations !== 'object') {
          cfg.integrations = {};
        }
        if (!cfg.integrations.autoSubs || typeof cfg.integrations.autoSubs !== 'object') {
          cfg.integrations.autoSubs = { enabled: false };
        }
        cfg.integrations.autoSubs.enabled = next;
        syncAutoSubsToggle(panel, cfg);
        onChange();
      });
    }

    const audioEnhancerButton = panel.querySelector('#btfw-theme-audio-enhancer-toggle');
    const audioEnhancerInput = panel.querySelector('#btfw-theme-audio-enhancer-enabled');
    if (audioEnhancerButton && audioEnhancerInput) {
      audioEnhancerButton.addEventListener('click', () => {
        const next = !audioEnhancerInput.checked;
        audioEnhancerInput.checked = next;
        if (!cfg.integrations || typeof cfg.integrations !== 'object') {
          cfg.integrations = {};
        }
        if (!cfg.integrations.audioEnhancer || typeof cfg.integrations.audioEnhancer !== 'object') {
          cfg.integrations.audioEnhancer = { enabled: false };
        }
        cfg.integrations.audioEnhancer.enabled = next;
        syncAudioEnhancerToggle(panel, cfg);
        onChange();
      });
    }

    // Developer mode toggle — flips localStorage["btfw:dev-nocache"]. This is
    // intentionally a per-browser setting (not a per-channel config) so the
    // channel admin can flip it while iterating without forcing all viewers
    // to take the cache-miss penalty. The framework reads the flag at boot,
    // so a reload is required to apply.
    wirePlaylistCatalogControls(panel, cfg, onChange);

    const devNoCacheButton = panel.querySelector('#btfw-theme-dev-nocache-toggle');
    if (devNoCacheButton) {
      const readDevState = () => {
        try { return localStorage.getItem("btfw:dev-nocache") === "1"; } catch (_) { return false; }
      };
      const writeDevState = (on) => {
        try {
          if (on) localStorage.setItem("btfw:dev-nocache", "1");
          else localStorage.removeItem("btfw:dev-nocache");
        } catch (_) {}
      };
      const renderDevState = () => {
        const on = readDevState();
        devNoCacheButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        const state = devNoCacheButton.querySelector('[data-role="state-label"]');
        if (state) state.textContent = on ? 'On' : 'Off';
      };
      renderDevState();
      devNoCacheButton.addEventListener('click', () => {
        writeDevState(!readDevState());
        renderDevState();
      });
    }

    const tmdbField = panel.querySelector('#btfw-theme-integrations-tmdb');
    if (tmdbField) {
      const syncNotice = () => {
        syncMovieInfoToggle(panel, cfg);
        syncMoviePollToggle(panel, cfg);
        syncAutoSubsToggle(panel, cfg);
        syncAudioEnhancerToggle(panel, cfg);
      };
      tmdbField.addEventListener('input', syncNotice);
      tmdbField.addEventListener('change', syncNotice);
    }

    // Wyzie API key test button — hits sub.wyzie.io with the current
    // input value against a known IMDB id (Halloween 5 1989) and reports
    // the API's verdict inline. No persistence; the user still has to
    // Save the panel to commit the key.
    const wyzieTestBtn = panel.querySelector('#btfw-theme-integrations-wyzie-test');
    const wyzieField = panel.querySelector('#btfw-theme-integrations-wyzie');
    const wyzieResult = panel.querySelector('[data-role="wyzie-test-result"]');
    if (wyzieTestBtn && wyzieField && wyzieResult) {
      const setResult = (text, tone) => {
        wyzieResult.hidden = false;
        wyzieResult.textContent = text;
        wyzieResult.classList.remove('is-success', 'is-error', 'is-pending');
        if (tone) wyzieResult.classList.add(`is-${tone}`);
      };
      wyzieTestBtn.addEventListener('click', async () => {
        const key = (wyzieField.value || '').trim();
        if (!key) {
          setResult('Enter a key above first.', 'error');
          return;
        }
        wyzieTestBtn.disabled = true;
        const originalLabel = wyzieTestBtn.textContent;
        wyzieTestBtn.textContent = 'Testing…';
        setResult('Checking with sub.wyzie.io…', 'pending');
        try {
          const url = `https://sub.wyzie.io/search?id=tt0098473&language=en&format=srt&key=${encodeURIComponent(key)}`;
          const resp = await fetch(url, { credentials: 'omit' });
          const body = await resp.json().catch(() => null);
          if (resp.ok && Array.isArray(body)) {
            setResult(`✓ Valid key — Wyzie returned ${body.length} subtitle entr${body.length === 1 ? 'y' : 'ies'} for the test movie.`, 'success');
          } else if (resp.status === 401) {
            setResult('✗ HTTP 401 — Wyzie says the key is missing. Paste it again and retry.', 'error');
          } else if (resp.status === 403) {
            setResult('✗ HTTP 403 — Wyzie rejected this key as invalid. Claim a new one at store.wyzie.io/redeem.', 'error');
          } else if (resp.status === 429) {
            setResult('✗ HTTP 429 — Rate-limited. Wait a moment and try again.', 'error');
          } else {
            const msg = body && body.message ? body.message : `${resp.status} ${resp.statusText || ''}`;
            setResult(`✗ Unexpected response: ${msg.trim()}`, 'error');
          }
        } catch (err) {
          setResult(`✗ Network error: ${err && err.message ? err.message : err}`, 'error');
        } finally {
          wyzieTestBtn.disabled = false;
          wyzieTestBtn.textContent = originalLabel;
        }
      });
    }

    // SubDL test key — searched directly from the browser (residential IP);
    // SubDL blocks datacenter/worker IPs, which is why it runs client-side.
    const subdlTestBtn = panel.querySelector('#btfw-theme-integrations-subdl-test');
    const subdlField = panel.querySelector('#btfw-theme-integrations-subdl');
    const subdlResult = panel.querySelector('[data-role="subdl-test-result"]');
    if (subdlTestBtn && subdlField && subdlResult) {
      const setResult = (text, tone) => {
        subdlResult.hidden = false;
        subdlResult.textContent = text;
        subdlResult.classList.remove('is-success', 'is-error', 'is-pending');
        if (tone) subdlResult.classList.add(`is-${tone}`);
      };
      subdlTestBtn.addEventListener('click', async () => {
        const key = (subdlField.value || '').trim();
        if (!key) {
          setResult('Enter a key above first.', 'error');
          return;
        }
        subdlTestBtn.disabled = true;
        const originalLabel = subdlTestBtn.textContent;
        subdlTestBtn.textContent = 'Testing…';
        setResult('Checking with api.subdl.com…', 'pending');
        try {
          const url = `https://api.subdl.com/api/v1/subtitles?api_key=${encodeURIComponent(key)}&imdb_id=tt0081505&languages=EN&type=movie`;
          const resp = await fetch(url, { credentials: 'omit' });
          const body = await resp.json().catch(() => null);
          if (resp.ok && body && body.status === true && Array.isArray(body.subtitles)) {
            setResult(`✓ Valid key — SubDL returned ${body.subtitles.length} subtitle${body.subtitles.length === 1 ? '' : 's'} for the test movie.`, 'success');
          } else if (resp.status === 401 || (body && body.error === 'not_authorized')) {
            setResult('✗ Key not recognized. Copy it again from subdl.com/panel/api.', 'error');
          } else if (resp.status === 403 || (body && body.error === 'not allowed')) {
            setResult('✗ HTTP 403 — your network/IP was rejected. (Note: this works from your browser, but not from datacenter IPs.)', 'error');
          } else {
            const msg = body && body.error ? body.error : `${resp.status} ${resp.statusText || ''}`;
            setResult(`✗ Unexpected response: ${String(msg).trim()}`, 'error');
          }
        } catch (err) {
          setResult(`✗ Network error: ${err && err.message ? err.message : err}`, 'error');
        } finally {
          subdlTestBtn.disabled = false;
          subdlTestBtn.textContent = originalLabel;
        }
      });
    }

    /* ---- Emote Marketplace: add-pack form + saved-pack list ---- */
    const mktProvider   = panel.querySelector('#btfw-emote-mkt-provider');
    const mktId         = panel.querySelector('#btfw-emote-mkt-id');
    const mktLabel      = panel.querySelector('#btfw-emote-mkt-label');
    const mktAddBtn     = panel.querySelector('#btfw-emote-mkt-add');
    const mktPreviewBtn = panel.querySelector('#btfw-emote-mkt-preview-btn');
    const mktPreview    = panel.querySelector('[data-role="emote-mkt-preview"]');
    const mktResult     = panel.querySelector('[data-role="emote-mkt-result"]');
    const mktList       = panel.querySelector('[data-role="emote-pack-list"]');

    const setMktResult = (text, tone) => {
      if (!mktResult) return;
      mktResult.hidden = !text;
      mktResult.textContent = text || '';
      mktResult.classList.remove('is-success', 'is-error', 'is-pending');
      if (text && tone) mktResult.classList.add(`is-${tone}`);
    };

    // Unlike the staged form fields, a pack add/remove/toggle/rename is a
    // discrete action the owner expects to *save*. So besides updating the
    // working config + the live runtime, we write it straight into the Channel
    // JS block and submit (same as clicking Apply) — debounced so a burst of
    // changes collapses into one save. This is why pack edits show up in the
    // Channel JS editor without a separate Apply click.
    let _emotePersistTimer = null;
    const persistEmotePacks = () => {
      const applyBtn = panel.querySelector('#btfw-theme-apply');
      if (!applyBtn) { onChange(); return; } // fallback: at least stage the change
      if (_emotePersistTimer) clearTimeout(_emotePersistTimer);
      _emotePersistTimer = setTimeout(() => {
        try { applyBtn.click(); } catch (_) { onChange(); }
      }, 450);
    };
    const commitEmotePacks = () => {
      if (!Array.isArray(cfg.emotePacks)) cfg.emotePacks = [];
      renderEmotePackList(panel, cfg);
      const snapshot = cfg.emotePacks.map(p => ({ provider: p.provider, id: p.id, label: p.label, enabled: p.enabled }));
      getEmoteMktApi().then(api => { if (api && api.setConfig) api.setConfig(snapshot); });
      persistEmotePacks();
    };

    // Cache the last good preview so "Add pack" can reuse it; cleared when the
    // provider or id changes.
    let lastPreview = null; // { provider, id, data }
    const clearPreview = () => {
      lastPreview = null;
      if (mktPreview) { mktPreview.hidden = true; mktPreview.innerHTML = ''; }
    };

    if (mktProvider && mktId) {
      const HINTS = {
        "7tv":  { label: "7TV set URL or ID", hint: 'Browse emotes on <a href="https://7tv.app/emotes" target="_blank" rel="noopener">7tv.app</a>, open a set, and paste its URL (looks like <code>7tv.app/emote-sets/…</code>).', ph: "https://7tv.app/emote-sets/01F6…" },
        "bttv": { label: "BetterTTV: \"global\" or Twitch user ID", hint: 'Type <code>global</code> for BTTV global emotes, or a channel\'s numeric Twitch user ID.', ph: "global" },
        "ffz":  { label: "FrankerFaceZ: channel name or \"global\"", hint: 'Type a Twitch channel name for its FFZ emotes (or a <a href="https://www.frankerfacez.com/" target="_blank" rel="noopener">frankerfacez.com</a>/channel/&lt;name&gt; URL), or <code>global</code>.', ph: "lirik" },
        "egg":  { label: "emoji.gg pack URL", hint: 'Pick from the packs currently listed on <a href="https://emoji.gg/packs" target="_blank" rel="noopener">emoji.gg/packs</a> (only those ~100 work via emoji.gg\'s API) and paste the pack URL.', ph: "https://emoji.gg/pack/598443-frieren" }
      };
      const idLabel = panel.querySelector('[data-role="id-label"]');
      const idHint  = panel.querySelector('[data-role="id-hint"]');
      const syncHints = () => {
        const h = HINTS[mktProvider.value] || HINTS["7tv"];
        if (idLabel) idLabel.textContent = h.label;
        if (idHint) idHint.innerHTML = h.hint;
        mktId.placeholder = h.ph;
      };
      mktProvider.addEventListener('change', () => { syncHints(); clearPreview(); setMktResult(''); });
      mktId.addEventListener('input', () => { clearPreview(); });
      syncHints();
    }

    // Fetch a pack and show a thumbnail preview (no add). Returns {provider,id,data} or null.
    const doPreview = async () => {
      if (!mktProvider || !mktId) return null;
      const provider = mktProvider.value;
      const id = parseEmotePackId(provider, mktId.value);
      if (!id) { setMktResult('Could not read a pack ID from that. Check the format hint above.', 'error'); return null; }
      const btn = mktPreviewBtn;
      const orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
      if (mktAddBtn) mktAddBtn.disabled = true;
      setMktResult('Fetching pack from ' + ((EMOTE_PROVIDER_META[provider] || {}).name || provider) + '…', 'pending');
      try {
        const api = await getEmoteMktApi();
        if (!api || !api.fetchPackPreview) throw new Error('marketplace module unavailable');
        const data = await api.fetchPackPreview(provider, String(id));
        const count = (data && data.emotes && data.emotes.length) || 0;
        if (!count) { setMktResult('Loaded, but found 0 emotes — double-check the ID.', 'error'); clearPreview(); return null; }
        lastPreview = { provider, id: String(id), data };
        renderEmotePreview(mktPreview, data);
        setMktResult(`✓ “${data.name || id}” — ${count} emote${count === 1 ? '' : 's'} found. Click Add pack to use it.`, 'success');
        return lastPreview;
      } catch (err) {
        setMktResult(`✗ Couldn't load that pack: ${err && err.message ? err.message : err}`, 'error');
        clearPreview();
        return null;
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        if (mktAddBtn) mktAddBtn.disabled = false;
      }
    };

    if (mktPreviewBtn) mktPreviewBtn.addEventListener('click', doPreview);

    if (mktAddBtn && mktProvider && mktId) {
      mktAddBtn.addEventListener('click', async () => {
        const provider = mktProvider.value;
        const id = parseEmotePackId(provider, mktId.value);
        if (!id) { setMktResult('Could not read a pack ID from that. Check the format hint above.', 'error'); return; }
        if (!Array.isArray(cfg.emotePacks)) cfg.emotePacks = [];
        if (cfg.emotePacks.some(p => p.provider === provider && String(p.id) === String(id))) {
          setMktResult('That pack is already added.', 'error');
          return;
        }
        // Reuse the matching preview, else fetch+validate now.
        let preview = (lastPreview && lastPreview.provider === provider && lastPreview.id === String(id)) ? lastPreview : null;
        if (!preview) { preview = await doPreview(); if (!preview) return; }
        const data = preview.data;
        const count = (data.emotes && data.emotes.length) || 0;
        cfg.emotePacks.push({
          provider,
          id: String(id),
          label: (mktLabel && mktLabel.value.trim()) || "",
          enabled: true
        });
        commitEmotePacks();
        setMktResult(`✓ Added “${data.name || id}” — ${count} emote${count === 1 ? '' : 's'}. Saved to the channel — it's now a tab in the emote picker.`, 'success');
        if (mktLabel) mktLabel.value = "";
        mktId.value = "";
        clearPreview();
      });
    }

    if (mktList) {
      mktList.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-act]');
        if (!btn) return;
        const row = btn.closest('[data-key]');
        if (!row) return;
        const key = row.getAttribute('data-key');
        if (!Array.isArray(cfg.emotePacks)) cfg.emotePacks = [];
        const idx = cfg.emotePacks.findIndex(p => (p.provider + ':' + p.id) === key);
        if (idx < 0) return;
        const act = btn.getAttribute('data-act');
        if (act === 'remove') {
          cfg.emotePacks.splice(idx, 1);
          commitEmotePacks();
        } else if (act === 'toggle') {
          cfg.emotePacks[idx].enabled = cfg.emotePacks[idx].enabled === false;
          commitEmotePacks();
        } else if (act === 'rename') {
          startRenamePack(row, idx, cfg, commitEmotePacks);
        }
      });
    }

    // Once the loader resolves emote counts (async), repaint the rows so each
    // shows its real "N emotes" — but not while an inline rename is in progress.
    if (mktList) {
      document.addEventListener('btfw:emotePacks:changed', () => {
        if (panel.isConnected && !mktList.querySelector('.btfw-emote-pack__rename-input')) renderEmotePackList(panel, cfg);
      });
    }
  }

  function updateInputs(panel, cfg){
    $$('[data-btfw-bind]', panel).forEach(input => {
      const path = input.dataset.btfwBind;
      let value = cfg;
      path.split('.').forEach(part => { if (value) value = value[part]; });
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (input.tagName === "TEXTAREA") {
        if (Array.isArray(value)) {
          input.value = value.join('\n');
        } else {
          input.value = value || "";
        }
      } else if (input.type === "color") {
        input.value = value || "#000000";
      } else {
        input.value = value ?? "";
      }
    });
    const root = document.documentElement;
    if (root) {
      root.classList.add("btfw-poll-overlay-enabled");
      root.classList.remove("btfw-poll-overlay-disabled");
    }
    const modules = normalizeModuleUrls(collectModuleCandidates(cfg));
    renderModuleInputs(panel, modules);
    ensureModuleFieldAvailability(panel);
    updateTypographyFieldState(panel);
    updateSliderFieldState(panel);
    syncMovieInfoToggle(panel, cfg);
    syncGradientEditor(panel, cfg);
    syncDitherToggle(panel, cfg);
    syncMoviePollToggle(panel, cfg);
    syncAutoSubsToggle(panel, cfg);
    syncAudioEnhancerToggle(panel, cfg);
    renderEmotePackList(panel, cfg);
    renderPreview(panel, cfg);
  }

  function setValueAtPath(obj, path, value){
    const parts = path.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function collectConfig(panel, cfg){
    const updated = cloneDefaults();
    deepMerge(updated, cfg);
    $$('[data-btfw-bind]', panel).forEach(input => {
      const path = input.dataset.btfwBind;
      let value;
      if (input.type === "checkbox") {
        value = input.checked;
      } else if (input.tagName === "TEXTAREA") {
        const lines = input.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        value = lines;
      } else {
        value = input.value;
        if (typeof value === "string") {
          value = value.trim();
        }
      }
      setValueAtPath(updated, path, value);
    });
    if (!updated.resources || typeof updated.resources !== "object") {
      updated.resources = cloneDefaults().resources;
    }
    updated.resources.modules = normalizeModuleUrls(readModuleValues(panel));
    delete updated.resources.moduleUrls;
    delete updated.resources.externalModules;
    delete updated.moduleUrls;
    delete updated.externalModules;
    if (!updated.slider || typeof updated.slider !== "object") {
      updated.slider = cloneDefaults().slider;
    }
    updated.sliderEnabled = Boolean(updated.slider?.enabled);
    updated.sliderJson = updated.slider?.feedUrl || "";
    if (!updated.material || typeof updated.material !== "object") {
      updated.material = cloneDefaults().material;
    }
    updated.material.dither = Boolean(updated.material.dither);
    if (!DITHER_INTENSITIES.includes(updated.material.ditherIntensity)) {
      updated.material.ditherIntensity = "subtle";
    }
    normalizeGradientConfig(updated);
    if (!updated.integrations || typeof updated.integrations !== "object") {
      updated.integrations = cloneDefaults().integrations;
    }
    if (typeof updated.integrations.enabled !== "boolean") {
      updated.integrations.enabled = true;
    }
    if (!updated.integrations.tmdb || typeof updated.integrations.tmdb !== "object") {
      updated.integrations.tmdb = { apiKey: "" };
    }
    updated.integrations.tmdb.apiKey = (updated.integrations.tmdb.apiKey || "").trim();
    if (!updated.event || typeof updated.event !== "object") {
      updated.event = { ...DEFAULT_CONFIG.event };
    }
    updated.event.enabled = Boolean(updated.event.enabled);
    updated.event.title = String(updated.event.title || "").trim().slice(0, 80);
    updated.event.startsAtLocal = String(updated.event.startsAtLocal || "").trim();
    // The datetime-local string is interpreted in the OWNER's timezone here,
    // at save time, and stored as a UTC epoch so every viewer localizes it.
    const eventMs = updated.event.startsAtLocal ? new Date(updated.event.startsAtLocal).getTime() : 0;
    updated.event.startsAtMs = Number.isFinite(eventMs) && eventMs > 0 ? eventMs : 0;
    if (!updated.integrations.wyzie || typeof updated.integrations.wyzie !== "object") {
      updated.integrations.wyzie = { apiKey: "" };
    }
    updated.integrations.wyzie.apiKey = (updated.integrations.wyzie.apiKey || "").trim();
    if (!updated.integrations.ratings || typeof updated.integrations.ratings !== "object") {
      updated.integrations.ratings = { endpoint: "" };
    }
    if (typeof updated.integrations.ratings.endpoint !== "string") {
      updated.integrations.ratings.endpoint = "";
    } else {
      updated.integrations.ratings.endpoint = updated.integrations.ratings.endpoint.trim();
    }
    if (!updated.integrations.movieInfo || typeof updated.integrations.movieInfo !== "object") {
      updated.integrations.movieInfo = { enabled: false };
    }
    updated.integrations.movieInfo.enabled = Boolean(updated.integrations.movieInfo.enabled);
    if (!updated.integrations.autoSubs || typeof updated.integrations.autoSubs !== "object") {
      updated.integrations.autoSubs = { enabled: false };
    }
    updated.integrations.autoSubs.enabled = Boolean(updated.integrations.autoSubs.enabled);
    if (!updated.playlistCatalog || typeof updated.playlistCatalog !== "object") {
      updated.playlistCatalog = { enabled: false, tmdbListUrl: "" };
    }
    updated.playlistCatalog.enabled = Boolean(updated.playlistCatalog.enabled);
    updated.playlistCatalog.tmdbListUrl = String(updated.playlistCatalog.tmdbListUrl || "").trim();
    if (updated.features && typeof updated.features === "object") {
      delete updated.features.videoOverlayPoll;
      if (Object.keys(updated.features).length === 0) {
        delete updated.features;
      }
    }
    if (!updated.typography || typeof updated.typography !== "object") {
      updated.typography = cloneDefaults().typography;
    }
    if (!updated.branding || typeof updated.branding !== "object") {
      updated.branding = cloneDefaults().branding;
    }
    if (typeof updated.branding.headerName !== "string") {
      updated.branding.headerName = "";
    }
    if (typeof updated.branding.faviconUrl !== "string") {
      updated.branding.faviconUrl = "";
    }
    if (typeof updated.branding.posterUrl !== "string") {
      updated.branding.posterUrl = "";
    }
    updated.headerName = updated.branding.headerName;
    updated.faviconUrl = updated.branding.faviconUrl;
    updated.posterUrl = updated.branding.posterUrl;
    const typo = updated.typography || {};
    typo.preset = normalizeFontId(typo.preset || FONT_DEFAULT_ID);
    if (typo.preset !== 'custom') {
      typo.customFamily = '';
    } else {
      typo.customFamily = (typo.customFamily || '').trim();
    }
    updated.typography = {
      preset: typo.preset,
      customFamily: typo.customFamily || ''
    };
    if (!updated.branding || typeof updated.branding !== "object") {
      updated.branding = cloneDefaults().branding;
    }
    if (typeof updated.branding.favicon === "string" && !updated.branding.faviconUrl) {
      updated.branding.faviconUrl = updated.branding.favicon;
    }
    updated.branding.favicon = updated.branding.faviconUrl || '';
    updated.branding.posterUrl = (updated.branding.posterUrl || '').trim();
    updated.branding.headerName = (updated.branding.headerName || '').trim();
    updated.version = DEFAULT_CONFIG.version;
    return updated;
  }

  function triggerChannelSubmit(modal, jsField, cssField){
    const roots = [];
    if (modal) roots.push(modal);
    roots.push(document);

    const selectors = [
      '#cs-jssubmit',
      '#cs-csssubmit',
      "button[name='save-js']",
      "button[name='save-css']",
      "button[data-action='save-js']",
      "button[data-action='save-css']"
    ];

    const clicked = new Set();
    selectors.forEach(sel => {
      roots.forEach(root => {
        if (!root) return;
        const el = root.querySelector(sel);
        if (!el || clicked.has(el) || typeof el.click !== 'function') return;
        try {
          el.click();
          clicked.add(el);
        } catch (_) {}
      });
    });

    let submitted = clicked.size > 0;
    const formSet = new Set();
    if (jsField && jsField.form) formSet.add(jsField.form);
    if (cssField && cssField.form) formSet.add(cssField.form);
    formSet.forEach(form => {
      if (!form) return;
      try {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          submitted = true;
        } else if (typeof form.submit === 'function') {
          form.submit();
          submitted = true;
        }
      } catch (_) {}
    });

    return submitted;
  }

  function extractSliderSettings(jsText){
    if (!jsText) return {};
    const settings = {};

    const parsed = parseConfig(jsText);
    if (parsed && typeof parsed === "object") {
      const slider = parsed.slider || {};
      if (typeof slider.enabled === "boolean") {
        settings.enabled = slider.enabled;
      } else if (typeof parsed.sliderEnabled === "boolean") {
        settings.enabled = parsed.sliderEnabled;
      }

      let rawUrl = slider.feedUrl || slider.url || slider.json || '';
      if (!rawUrl) {
        rawUrl = parsed.sliderJson || parsed.sliderJSON || '';
      }
      if (typeof rawUrl !== "undefined") {
        if (typeof rawUrl !== "string") {
          rawUrl = String(rawUrl);
        }
        settings.url = rawUrl.trim();
      }
    }

    if (typeof settings.enabled === "undefined" || typeof settings.url === "undefined") {
      const enabledMatch = jsText.match(/UI_ChannelList\s*=\s*(['"]?)([01])\1/);
      if (typeof settings.enabled === "undefined" && enabledMatch) {
        settings.enabled = enabledMatch[2] === '1';
      }
      const urlMatch = jsText.match(/Channel_JSON\s*=\s*(['"`])([^'"`]*?)\1/);
      if (typeof settings.url === "undefined" && urlMatch) {
        settings.url = urlMatch[2].trim();
      }
    }

    return settings;
  }

  function stripLegacySliderGlobals(jsText){
    const source = typeof jsText === 'string' ? jsText : '';
    if (!source) return '';

    const lines = source.split(/\r?\n/);
    const cleaned = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (/^(?:var|let|const)?\s*UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^window\.UI_ChannelList\s*=/.test(trimmed)) continue;
      if (/^(?:var|let|const)?\s*Channel_JSON\s*=/.test(trimmed)) continue;
      if (/^window\.Channel_JSON\s*=/.test(trimmed)) continue;
      cleaned.push(line);
    }

    while (cleaned.length && cleaned[0].trim() === '') {
      cleaned.shift();
    }
    for (let i = cleaned.length - 1; i > 0; i--) {
      if (cleaned[i].trim() === '' && cleaned[i - 1].trim() === '') {
        cleaned.splice(i, 1);
      }
    }

    return cleaned.join('\n');
  }

  function ensureTab(modal){
    if (!modal) return null;

    const { tabContainer, contentContainer } = ensureTabSystem(modal);
    const panelHost = contentContainer || modal.querySelector('.tab-content') || modal;

    let panel = panelHost?.querySelector('#btfw-theme-admin-panel');
    if (panel) return panel;

    if (!tabContainer || !panelHost) return null;

    let tab = tabContainer.querySelector("li[data-btfw-theme-tab]");
    if (!tab) {
      const existingLink = tabContainer.querySelector("a[href='#btfw-theme-admin-panel'], a[data-target='#btfw-theme-admin-panel']");
      if (existingLink) {
        tab = existingLink.closest('li') || existingLink;
        tab.dataset.btfwThemeTab = "1";
      } else if (tabContainer.tagName === 'UL' || tabContainer.tagName === 'OL' || tabContainer.classList.contains('nav-tabs')) {
        tab = document.createElement('li');
        tab.dataset.btfwThemeTab = "1";
        const anchor = document.createElement('a');
        anchor.href = '#btfw-theme-admin-panel';
        anchor.setAttribute('data-toggle', 'tab');
        anchor.innerHTML = '<span class="fa fa-magic"></span> <span>Theme</span>';
        anchor.style.display = 'flex';
        anchor.style.alignItems = 'center';
        anchor.style.gap = '8px';
        tab.appendChild(anchor);
        tabContainer.appendChild(tab);
      } else {
        const anchor = document.createElement('a');
        anchor.href = '#btfw-theme-admin-panel';
        anchor.setAttribute('data-toggle', 'tab');
        anchor.className = 'btfw-theme-tab-toggle';
        anchor.innerHTML = '<span class="fa fa-magic"></span> <span>Theme</span>';
        tabContainer.appendChild(anchor);
        tab = anchor;
      }
    }

    panel = document.createElement('div');
    panel.id = 'btfw-theme-admin-panel';
    panel.className = 'tab-pane';
    panel.setAttribute('role', 'tabpanel');
    panel.style.display = 'none';
    panelHost.appendChild(panel);

    return panel;
  }

  // --- CodeMirror bridge -------------------------------------------------
  // CyTube wraps the Channel JS/CSS textareas in CodeMirror. While CM is live it
  // OWNS the content: writing textarea.value is silently reverted, because the
  // Save buttons call cm.save() (CM doc -> textarea) right before reading. So any
  // time we read or write a managed field we must go through the CM instance when
  // one is attached, falling back to the raw textarea otherwise.
  function codeMirrorFor(field){
    if (!field) return null;
    try {
      // CodeMirror.fromTextArea inserts its wrapper element right after the textarea.
      const sib = field.nextElementSibling;
      if (sib && sib.CodeMirror && typeof sib.CodeMirror.getValue === "function") {
        return sib.CodeMirror;
      }
      // Fallback: match by the textarea CM was created from.
      const wrappers = document.querySelectorAll(".CodeMirror");
      for (let i = 0; i < wrappers.length; i++) {
        const cm = wrappers[i].CodeMirror;
        if (cm && typeof cm.getTextArea === "function" && cm.getTextArea() === field) {
          return cm;
        }
      }
    } catch (_) {}
    return null;
  }

  function readFieldValue(field){
    if (!field) return "";
    const cm = codeMirrorFor(field);
    if (cm) { try { return cm.getValue(); } catch (_) {} }
    return field.value || "";
  }

  function writeFieldValue(field, value){
    if (!field) return;
    field.value = value;
    const cm = codeMirrorFor(field);
    if (cm) {
      try {
        cm.setValue(value);
        // Push the CM doc back into the textarea so a plain form read is correct too.
        if (typeof cm.save === "function") cm.save();
      } catch (_) {}
    }
    ["input", "change"].forEach(type => {
      try { field.dispatchEvent(new Event(type, { bubbles: true })); } catch (_) {}
    });
  }

  function applyConfigToFields(panel, cfg, modal, options = {}){
    const mode = options.mode || 'manual';
    const status = panel.querySelector('#btfw-theme-status');
    const jsField = ensureField(modal, JS_FIELD_SELECTORS, "chanjs");
    const cssField = ensureField(modal, CSS_FIELD_SELECTORS, "chancss");
    if (!jsField || !cssField) {
      if (status) {
        status.textContent = "Could not find Channel JS or CSS fields.";
        status.dataset.variant = "error";
      }
      return;
    }

    const existingJs = readFieldValue(jsField);
    const existingCss = readFieldValue(cssField);

    const mergedConfig = collectConfig(panel, cfg);
    const jsBlock = buildConfigBlock(mergedConfig);
    const cssBlock = buildCssBlock(mergedConfig);

    const cleanedJs = stripLegacySliderGlobals(existingJs);
    writeFieldValue(jsField, replaceBlock(cleanedJs, JS_BLOCK_START, JS_BLOCK_END, jsBlock));
    writeFieldValue(cssField, replaceBlock(existingCss, CSS_BLOCK_START, CSS_BLOCK_END, cssBlock));

    const runtimeConfig = syncRuntimeThemeConfig(mergedConfig) || mergedConfig;

    if (status) {
      if (mode === 'manual') {
        status.textContent = "Theme JS & CSS applied. Submitting changes...";
        status.dataset.variant = "pending";
      } else if (mode === 'init') {
        status.textContent = "BillTube theme prepared. Click apply to submit changes.";
        status.dataset.variant = "idle";
      }
    }
    renderPreview(panel, runtimeConfig);
    return { config: runtimeConfig, jsField, cssField };
  }

  function initPanel(modal){
    if (!canManageChannel()) return false;
    const panel = ensureTab(modal);
    if (!panel || panel.dataset.initialized === "1") return Boolean(panel);

    renderPanel(panel);
    wireFilterStatus(panel);
    wireAdminNav(panel);

    const jsField = ensureField(modal, JS_FIELD_SELECTORS, "chanjs");
    const cssField = ensureField(modal, CSS_FIELD_SELECTORS, "chancss");
    const storedConfig = parseConfig(readFieldValue(jsField));
    const cfg = deepMerge(cloneDefaults(), storedConfig || {});
    const storedVersion = Number(cfg.version) || 0;
    cfg.version = DEFAULT_CONFIG.version;

    if (!cfg.slider || typeof cfg.slider !== "object") {
      cfg.slider = cloneDefaults().slider;
    }
    if (typeof cfg.sliderEnabled === "boolean") {
      cfg.slider.enabled = cfg.sliderEnabled;
    }
    if (typeof cfg.sliderJson === "string" && !cfg.slider.feedUrl) {
      cfg.slider.feedUrl = cfg.sliderJson;
    }

    if (!cfg.integrations || typeof cfg.integrations !== "object") {
      cfg.integrations = cloneDefaults().integrations;
    }
    if (typeof cfg.integrations.enabled !== "boolean") {
      cfg.integrations.enabled = true;
    }
    if (!cfg.integrations.tmdb || typeof cfg.integrations.tmdb !== "object") {
      cfg.integrations.tmdb = { apiKey: "" };
    }
    if (!cfg.integrations.wyzie || typeof cfg.integrations.wyzie !== "object") {
      cfg.integrations.wyzie = { apiKey: "" };
    }
    if (!cfg.integrations.ratings || typeof cfg.integrations.ratings !== "object") {
      cfg.integrations.ratings = { endpoint: "" };
    }
    if (!cfg.integrations.movieInfo || typeof cfg.integrations.movieInfo !== "object") {
      cfg.integrations.movieInfo = { enabled: false };
    }
    cfg.integrations.movieInfo.enabled = Boolean(cfg.integrations.movieInfo.enabled);

    if (!cfg.integrations.autoSubs || typeof cfg.integrations.autoSubs !== "object") {
      cfg.integrations.autoSubs = { enabled: false };
    }
    cfg.integrations.autoSubs.enabled = Boolean(cfg.integrations.autoSubs.enabled);

    if (!cfg.branding || typeof cfg.branding !== "object") {
      cfg.branding = cloneDefaults().branding;
    }
    if (typeof cfg.branding.favicon === "string" && !cfg.branding.faviconUrl) {
      cfg.branding.faviconUrl = cfg.branding.favicon;
    }
    if (typeof cfg.headerName === "string" && !cfg.branding.headerName) {
      cfg.branding.headerName = cfg.headerName;
    }
    if (typeof cfg.branding.header === "string" && !cfg.branding.headerName) {
      cfg.branding.headerName = cfg.branding.header;
    }
    if (typeof cfg.faviconUrl === "string" && !cfg.branding.faviconUrl) {
      cfg.branding.faviconUrl = cfg.faviconUrl;
    }
    if (typeof cfg.posterUrl === "string" && !cfg.branding.posterUrl) {
      cfg.branding.posterUrl = cfg.posterUrl;
    }
    if (typeof cfg.branding.posterUrl !== "string") {
      cfg.branding.posterUrl = '';
    }

    if (!cfg.resources || typeof cfg.resources !== "object") {
      cfg.resources = cloneDefaults().resources;
    }
    if (!Array.isArray(cfg.resources.styles)) {
      cfg.resources.styles = [];
    }
    if (!Array.isArray(cfg.resources.scripts)) {
      cfg.resources.scripts = [];
    }
    const resourceModules = normalizeModuleUrls(collectModuleCandidates(cfg));
    cfg.resources.modules = resourceModules;
    delete cfg.resources.moduleUrls;
    delete cfg.resources.externalModules;
    delete cfg.moduleUrls;
    delete cfg.externalModules;
    delete cfg.modules;

    const sliderState = extractSliderSettings(readFieldValue(jsField));
    if (typeof sliderState.enabled === "boolean") {
      cfg.slider.enabled = sliderState.enabled;
      cfg.sliderEnabled = sliderState.enabled;
    }
    if (typeof sliderState.url !== "undefined") {
      cfg.slider.feedUrl = sliderState.url || "";
      cfg.sliderJson = sliderState.url || "";
    }

    if (!cfg.background || typeof cfg.background !== "object") {
      cfg.background = { ...DEFAULT_CONFIG.background };
    }
    if (!BG_PATTERNS[cfg.background.pattern] && cfg.background.pattern !== "none") {
      cfg.background.pattern = "none";
    }
    if (!PATTERN_OPACITY[cfg.background.intensity]) {
      cfg.background.intensity = "medium";
    }
    if (!cfg.material || typeof cfg.material !== "object") {
      cfg.material = cloneDefaults().material;
    }
    cfg.material.dither = Boolean(cfg.material.dither);
    if (!DITHER_INTENSITIES.includes(cfg.material.ditherIntensity)) {
      cfg.material.ditherIntensity = "subtle";
    }
    normalizeGradientConfig(cfg);

let initializing = true;
updateInputs(panel, cfg);
initializing = false;
wirePatternPicker(panel, cfg);
wireBackup(panel, cfg);

setTimeout(() => {
  const modules = normalizeModuleUrls(collectModuleCandidates(cfg));
  renderModuleInputs(panel, modules);
  ensureModuleFieldAvailability(panel);
}, 50);

    let dirty = false;
    const status = panel.querySelector('#btfw-theme-status');

    const markDirty = () => {
      if (initializing) return;
      const latest = collectConfig(panel, cfg);
      overwriteConfig(cfg, latest);
      renderPreview(panel, cfg);
      dirty = true;
      if (status) {
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "pending";
      }
    };

    watchInputs(panel, cfg, markDirty);

    // CRITICAL FIX: Ensure module fields are initialized after binding
    setTimeout(() => {
      const container = getModuleContainer(panel);
      if (container) {
        ensureModuleFieldAvailability(panel);
      } else {
        console.error('[theme-admin] Module container NOT found after panel init');
      }
    }, 100);

    const applyBtn = panel.querySelector('#btfw-theme-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const latest = collectConfig(panel, cfg);
        overwriteConfig(cfg, latest);
        const result = applyConfigToFields(panel, cfg, modal, { mode: 'manual' });
        if (!result) return;
        dirty = false;
        window.setTimeout(() => {
          const submitted = triggerChannelSubmit(modal, result.jsField, result.cssField);
          if (status) {
            if (submitted) {
              status.textContent = "Theme JS & CSS applied and submitted to CyTube.";
              status.dataset.variant = "saved";
            } else {
              status.textContent = "Theme JS & CSS applied. Save channel settings to publish.";
              status.dataset.variant = "idle";
            }
          }
        }, 60);
      });
    }

    // Move the Apply/Reset/status bar into the modal's own footer so it sits
    // at the true bottom next to Close (done AFTER wiring so the click
    // handlers travel with the elements). Shown only while this tab is active.
    const actionsBar = panel.querySelector('.btfw-admin-actions');
    const modalFooter = modal.querySelector('.modal-footer');
    if (actionsBar && modalFooter && actionsBar.parentElement !== modalFooter) {
      modalFooter.insertBefore(actionsBar, modalFooter.firstChild);
    }
    const syncActionsVisibility = () => {
      if (!actionsBar || actionsBar.parentElement !== modalFooter) return;
      const active = panel.classList.contains('active') || panel.style.display === 'block';
      actionsBar.classList.toggle('is-visible', active);
    };
    syncActionsVisibility();

    const observer = new MutationObserver(() => {
      const active = panel.classList.contains('active') || panel.style.display === 'block';
      syncActionsVisibility();
      if (active && status && dirty) {
        status.textContent = "Changes pending. Click apply to sync with Channel JS/CSS.";
        status.dataset.variant = "pending";
      }
      if (active && Date.now() - filterStatusLastCheck > 60000) {
        runFilterStatusCheck(panel);
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });

    const existingJs = readFieldValue(jsField);
    const existingCss = readFieldValue(cssField);
    const hasJsBlock = existingJs.includes(JS_BLOCK_START) && existingJs.includes(JS_BLOCK_END);
    const hasCssBlock = existingCss.includes(CSS_BLOCK_START) && existingCss.includes(CSS_BLOCK_END);
    const currentVersion = storedVersion;
    let needsInit = !hasJsBlock || !hasCssBlock;
    if (currentVersion < DEFAULT_CONFIG.version) {
      cfg.version = DEFAULT_CONFIG.version;
      needsInit = true;
    }
    if (needsInit) {
      dirty = true;
      if (status) {
        status.textContent = "Theme config needs to be applied. Click Apply to sync with Channel JS/CSS.";
        status.dataset.variant = "idle";
      }
    } else if (status && !dirty) {
      status.textContent = "Theme settings loaded. No changes applied yet.";
      status.dataset.variant = "idle";
    }

    panel.dataset.initialized = "1";
    return true;
  }

  const CHANNEL_MODAL_SELECTOR = "#channeloptions, #channelsettingsmodal, #channeloptionsmodal, .channel-settings-modal";

  function ensureModalPanel(modal){
    if (!modal || !canManageChannel()) return;
    if (!modal.dataset.btfwThemeAdminBound) {
      if (initPanel(modal)) {
        modal.dataset.btfwThemeAdminBound = "1";
      }
    } else {
      initPanel(modal);
    }
  }

  function boot(){
    if (!canManageChannel()) return;
    const modal = document.querySelector(CHANNEL_MODAL_SELECTOR);
    if (!modal) return;
    // The channel-settings modal exists while hidden. Building the complete
    // theme editor at page boot needlessly allocates every preview asset.
    const initializeWhenVisible = () => {
      const visible = modal.classList.contains("in") ||
        modal.classList.contains("show") ||
        modal.getAttribute("aria-hidden") === "false";
      if (visible) ensureModalPanel(modal);
    };
    initializeWhenVisible();
    if (!modal.dataset.btfwThemeAdminVisibilityObserved) {
      modal.dataset.btfwThemeAdminVisibilityObserved = "1";
      const visibilityObserver = new MutationObserver(initializeWhenVisible);
      visibilityObserver.observe(modal, {
        attributes: true,
        attributeFilter: ["class", "style", "aria-hidden"]
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  const bindModalEvents = (()=>{
    let bound = false;
    return function(){
      if (bound) return;
      bound = true;
      const handler = (event)=>{
        const modal = event?.target?.closest?.(CHANNEL_MODAL_SELECTOR) ||
          (event?.target && event.target.matches?.(CHANNEL_MODAL_SELECTOR) ? event.target : null);
        ensureModalPanel(modal);
      };
      document.addEventListener("show.bs.modal", handler, true);
      document.addEventListener("shown.bs.modal", handler, true);
    };
  })();

  bootstrapRuntimeThemeSync();
  bindModalEvents();

  return { name: "feature:channelThemeAdmin" };
});
