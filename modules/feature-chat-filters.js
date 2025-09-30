/* BillTube Framework — feature:chat-filters (imports required CyTube chat filters) */
BTFW.define("feature:chat-filters", [], async () => {
  const customFilters = [
    { name: "monospace", source: "`(.+?)`", flags: "g", replace: "<code>\\1</code>", active: true, filterlinks: false },
    { name: "bold", source: "\\*(.+?)\\*", flags: "g", replace: "<strong>\\1</strong>", active: true, filterlinks: false },
    { name: "italic", source: "_(.+?)_", flags: "g", replace: "<em>\\1</em>", active: true, filterlinks: false },
    { name: "strike", source: "~~(.+?)~~", flags: "g", replace: "<s>\\1</s>", active: true, filterlinks: false },
    { name: "inline spoiler", source: "\\[sp\\](.*?)\\[/sp\\]", flags: "gi", replace: "<span class=\"spoiler\">\\1</span>", active: true, filterlinks: false },
    { name: "partial quote", source: "&gt;(.+?)$", flags: "g", replace: "<span class=\"quote\">&gt;\\1 </span>", active: true, filterlinks: false },
    { name: "italic text", source: "\\[i\\](.+?)\\[/i\\]", flags: "g", replace: "<em>\\1</em>", active: true, filterlinks: false },
    { name: "monospace text", source: "\\[code\\](.+?)\\[/code\\]", flags: "gi", replace: "<code>\\1</code>", active: true, filterlinks: false },
    { name: "bold text", source: "\\[b\\](.+?)\\[/b\\]", flags: "gi", replace: "<strong>\\1</strong>", active: true, filterlinks: false },
    { name: "striked text", source: "\\[s\\](.+?)\\[/s\\]", flags: "gi", replace: "<s>\\1</s>", active: true, filterlinks: false },
    { name: "short spoiler", source: "\\[sp\\]", flags: "g", replace: "<span class=\"spoiler\">", active: true, filterlinks: false },
    { name: "closing font style", source: "\\[\\/\\]", flags: "g", replace: "<span>", active: true, filterlinks: false },
    { name: "chat colors (premium)", source: "col:(.*?):", flags: "g", replace: "<span style=\"color:\\1\" class=\"chatcolor\">", active: true, filterlinks: false },
    { name: "giphy", source: "https?://(?|media\\d\\.giphy\\.com/media/(?:[^/]+/)?([^ /\\n]+)/giphy\\.gif|i\\.giphy\\.com/([^ /\\n]+)\\.gif|giphy\\.com/gifs/(?:.*-)?([^ /\\n]+))", flags: "gi", replace: "<img class=\"giphy chat-picture\" src=\"https://media.giphy.com/media/\\1/200_s.gif\" />", active: true, filterlinks: true },
    { name: "tenor", source: "(https?://media\\.tenor\\.com/[^\\s]+\\.gif)", flags: "gi", replace: "<img class=\"tenor chat-picture\" src=\"\\0\" />", active: true, filterlinks: true }
  ];

  function getjQuery() {
    if (window.jQuery && typeof window.jQuery === "function") {
      return window.jQuery;
    }
    if (window.$ && typeof window.$ === "function") {
      return window.$;
    }
    return null;
  }

  function importCustomChatFiltersToTextarea($) {
    const exportTextField = $("#cs-chatfilters-exporttext");
    if (!exportTextField || !exportTextField.length) {
      console.error("[BTFW chat-filters] Unable to find export text field.");
      return;
    }
    try {
      exportTextField.val(JSON.stringify(customFilters, null, 2));
      console.info("[BTFW chat-filters] Imported custom chat filters into text field.", customFilters);
    } catch (error) {
      console.error("[BTFW chat-filters] Error serializing custom filters:", error);
    }
  }

  function addChatFilterButton($) {
    const chatFilterMenu = $("#cs-chatfilters");
    if (!chatFilterMenu || !chatFilterMenu.length) {
      console.error("[BTFW chat-filters] Chat filter menu not found.");
      return;
    }
    if (chatFilterMenu.find("#btfw-add-custom-filter-button").length) {
      return;
    }

    const newFilterButton = $(
      '<button id="btfw-add-custom-filter-button" class="btn btn-sm btn-primary" style="margin-top: 10px;">Import Required BillTube Chat Filters</button>'
    );
    newFilterButton.on("click", function (event) {
      event.preventDefault();
      importCustomChatFiltersToTextarea($);
    });

    chatFilterMenu.append(newFilterButton);
  }

  function init() {
    const $ = getjQuery();
    if (!$) {
      console.warn("[BTFW chat-filters] jQuery not available; cannot attach import button.");
      return;
    }

    const run = () => addChatFilterButton($);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  init();

  return {
    importCustomChatFiltersToTextarea: ($) => importCustomChatFiltersToTextarea($ || getjQuery())
  };
});
