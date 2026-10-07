// E5: Linked padding sides apply 29px to all four sides as ONE undoable transaction.
import { launch, freshPage, openWorkbench, shot, occStyle, layersSearch, layersClick, inspectorTab, openGroup, spacingInputs, linkSides, commitInput, railButton, railState, activityLines, finish } from './helpers.mjs';

const HERO = 'doc.northwind|svc.hero';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });

  await layersSearch(page, 'Introduction');
  await layersClick(page, HERO);
  await inspectorTab(page, 'Style');
  steps.groupOpened = await openGroup(page, 'Size & spacing');
  steps.inputsBefore = await spacingInputs(page, 'padding');
  steps.computedBefore = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    steps.computedBefore[side] = await occStyle(page, HERO, `padding-${side}`);
  }
  await shot(page, 'j5-01-spacing-before.png');

  // Link the sides and type 29 into one side.
  await linkSides(page, 'padding');
  steps.inputsLinked = await spacingInputs(page, 'padding');
  steps.editorUsed = await commitInput(page, 'padding top', '29');
  steps.inputsAfter = await spacingInputs(page, 'padding');
  steps.computedAfter = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    steps.computedAfter[side] = await occStyle(page, HERO, `padding-${side}`);
  }
  await shot(page, 'j5-02-linked-29.png');

  // Exactly ONE undo must return all four sides to their previous values.
  steps.undoClicked = await railButton(page, 'Undo');
  steps.inputsAfterUndo = await spacingInputs(page, 'padding');
  steps.computedAfterUndo = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    steps.computedAfterUndo[side] = await occStyle(page, HERO, `padding-${side}`);
  }
  await shot(page, 'j5-03-after-one-undo.png');
  steps.activity = await activityLines(page);
  steps.appliedCount = steps.activity.filter((l) => l.includes('Applied')).length;

  const same = (a, b) => a?.value === b?.value;
  const sides = (o) => JSON.stringify([o?.top, o?.right, o?.bottom, o?.left]);
  steps.assert = {
    linkedPressed: steps.inputsLinked?.linked === 'true',
    allFourInputs29px: [steps.inputsAfter?.top, steps.inputsAfter?.right, steps.inputsAfter?.bottom, steps.inputsAfter?.left].every((v) => v === '29px'),
    allFourComputed29: Object.values(steps.computedAfter ?? {}).every((v) => v?.value === '29px'),
    oneAppliedCommand: steps.appliedCount === 1,
    oneUndoRestoresAll: ['top', 'right', 'bottom', 'left'].every(
      (side) => steps.computedAfterUndo[side]?.value === steps.computedBefore[side]?.value,
    ),
    undoRestoresInputs: sides(steps.inputsAfterUndo) === sides(steps.inputsBefore),
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j5-linked-padding.json', { journey: 'E5 linked padding = one undoable transaction', steps, exceptions });
