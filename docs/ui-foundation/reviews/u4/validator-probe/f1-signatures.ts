/**
 * F1 signature check — illustrative widened-boundary signatures must
 * typecheck under strict mode WITHOUT weakening to `any`.
 * Run: npx tsx --tsconfig-check ... (compiled via tsc below)
 */
type UiPrimitiveType = 'string' | 'number' | 'boolean';
type UiValueType = UiPrimitiveType | 'stringList' | 'numberList' | 'isoDate' | 'isoTime';

/** The serializable runtime value carried across every UiValueType boundary. */
type UiValue = string | number | boolean | readonly string[] | readonly number[];

declare function isUiValueOfType(value: unknown, type: UiValueType): boolean;

interface UiLocalStateDecl {
  readonly key: string;
  readonly type: UiValueType;
  readonly initial: UiValue;
}
interface UiPropDecl {
  readonly name: string;
  readonly type: UiValueType;
  readonly default?: UiValue;
}
interface UiSvelteComponentIO {
  readonly emit: (output: string, payload?: UiValue) => void;
}
type HostStateValues = Readonly<Record<string, UiValue>>;
interface OutputDecl {
  readonly name: string;
  readonly payload: 'void' | UiValueType;
}

// ---- positive usage (must compile) ----
const stateDecl: UiLocalStateDecl = { key: 'sel', type: 'stringList', initial: [] };
const propDecl: UiPropDecl = { name: 'values', type: 'numberList', default: [1, 2] };
const io: UiSvelteComponentIO = { emit: (output, payload) => void 0 };
const hostValues: HostStateValues = { sel: ['a', 'b'], count: 3, open: true, due: '2026-01-31' };
const out: OutputDecl = { name: 'sel', payload: 'stringList' };
io.emit('valuesChange', ['a', 'b']);
io.emit('openChange', false);
io.emit('pageChange', 2);
const okList = isUiValueOfType(['a', 'b'], 'stringList');
const okDate = isUiValueOfType('2026-01-31', 'isoDate');

// ---- negative usage (must FAIL to compile; each line separately uncommented breaks tsc) ----
// io.emit('x', new Date());                    // library object — not a UiValue
// io.emit('x', { start: 'a', end: 'b' });      // nested object — no structure in the contract
// io.emit('x', [null]);                        // (as string[] literal: null is not a string)
// io.emit('x', ['a', 1]);                      // mixed members — not a UiValue
// stateDecl.initial = null;                    // null is not a UiValue
// const bad: number = isUiValueOfType([], 'stringList'); // boolean is not number

void stateDecl; void propDecl; void io; void hostValues; void out; void okList; void okDate;
console.log('F1 signatures typecheck (strict, no any); negative examples documented in the contract text');
