const presets = require("./presets.js");

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(2);
};

if (!Array.isArray(presets)) {
  fail("presets.js must export an array of groups.");
}

const groupIds = new Set();
const itemIds = new Set();
let itemCount = 0;

for (const group of presets) {
  if (!group || typeof group !== "object") {
    fail("Every group must be an object.");
  }
  if (!group.id || typeof group.id !== "string") {
    fail("Group is missing a string id.");
  }
  if (groupIds.has(group.id)) {
    fail(`Duplicate group id: ${group.id}`);
  }
  groupIds.add(group.id);

  if (!group.title || typeof group.title !== "string") {
    fail(`Group ${group.id} is missing a title.`);
  }
  if (!Array.isArray(group.items) || group.items.length === 0) {
    fail(`Group ${group.id} must have at least one item.`);
  }

  for (const item of group.items) {
    itemCount += 1;
    if (!item.id || typeof item.id !== "string") {
      fail(`Item in group ${group.id} is missing a string id.`);
    }
    if (itemIds.has(item.id)) {
      fail(`Duplicate item id: ${item.id}`);
    }
    itemIds.add(item.id);

    if (!item.label || typeof item.label !== "string") {
      fail(`Item ${item.id} is missing a label.`);
    }
    const hasAction = typeof item.action === "string" && item.action.trim().length > 0;
    if (hasAction) {
      const allowedActions = new Set(["obsidian-push"]);
      if (!allowedActions.has(item.action)) {
        fail(`Item ${item.id} has unsupported action: ${item.action}`);
      }
      if (typeof item.template !== "undefined" && typeof item.template !== "string") {
        fail(`Item ${item.id} has a non-string template.`);
      }
    } else {
      if (typeof item.template !== "string" || item.template.trim().length === 0) {
        fail(`Item ${item.id} has an empty template.`);
      }
    }
  }
}

console.log(`OK: ${groupIds.size} groups, ${itemCount} presets validated.`);
