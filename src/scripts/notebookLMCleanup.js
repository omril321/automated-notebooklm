/**
 * NotebookLM Cleanup Script
 *
 * Deletes NotebookLM projects older than 1 week.
 * Copy and paste this script into the browser console on the NotebookLM homepage.
 *
 * Usage:
 * 1. Navigate to https://notebooklm.google.com/
 * 2. Open browser DevTools (F12 or Cmd+Option+I)
 * 3. Go to the Console tab
 * 4. Paste this entire script and press Enter
 */

(async () => {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const findOldRow = () => {
    const rows = [...document.querySelectorAll("tr")];
    return rows.find((row) => {
      const dateCell = row.querySelector("td.created-time-column");
      if (!dateCell) return false;
      const rowDate = Date.parse(dateCell.textContent.trim());
      return !isNaN(rowDate) && rowDate < oneWeekAgo;
    });
  };

  let row;
  while ((row = findOldRow())) {
    const dateText = row.querySelector("td.created-time-column").textContent.trim();
    console.log(`Deleting row from ${dateText}`);

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 500));

    const menuBtn = row.querySelector('[aria-label="Project Actions Menu"]');
    if (!menuBtn) {
      console.log("No menu button found");
      break;
    }
    menuBtn.click();
    await new Promise((r) => setTimeout(r, 1000));

    const deleteEl = [...document.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && el.textContent.trim() === "Delete"
    );

    if (!deleteEl) {
      console.log("No delete element found");
      document.body.click();
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    deleteEl.click();
    await new Promise((r) => setTimeout(r, 700));

    const confirmBtn = [...document.querySelectorAll(".mdc-button__label")].find(
      (el) => el.textContent.trim() === "Delete"
    );
    if (!confirmBtn) {
      console.log("No confirm button found");
      break;
    }
    confirmBtn.click();

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("Cleanup complete");
})();
