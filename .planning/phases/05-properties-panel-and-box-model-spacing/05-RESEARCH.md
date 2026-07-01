# Phase 5 Research: Properties Panel & Box Model Spacing

Research and technical specifications for parsing styling metadata (specifically Tailwind spacing and sizing classes) and updating them non-destructively.

## 1. Tailwind Spacing and Sizing Class Structure

Tailwind uses atomic utility classes for sizing, spacing, positioning, and rotation:
- **Padding (`p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`)**
- **Margin (`m-`, `mx-`, `my-`, `mt-`, `mr-`, `mb-`, `ml-`)**
- **Sizing (`w-`, `h-`)**
- **Positioning (`absolute`, `relative`, `fixed`, `sticky`, `static`, and offsets `top-`, `right-`, `bottom-`, `left-`)**
- **Rotation (`rotate-`)**

## 2. Properties Parser Design

The properties parser `parseTailwindClasses(classStr: string)` should parse a space-separated class string and resolve the final box model spacing values:
- For example, if the class list has both `p-4` and `pt-6`, the specific `pt-6` overrides the top padding to `6` while other sides remain `4`.
- The parser outputs a structured object:
  ```typescript
  interface SpacingSide {
    value: string | null; // e.g. "4", "6", "1.5"
  }
  interface BoxModelProperties {
    padding: { top: string | null; right: string | null; bottom: string | null; left: string | null };
    margin: { top: string | null; right: string | null; bottom: string | null; left: string | null };
    width: string | null;
    height: string | null;
    position: string | null; // e.g. "absolute"
    offsets: { top: string | null; right: string | null; bottom: string | null; left: string | null };
  }
  ```

## 3. Properties Update/Formatter Design

The update function `updateTailwindClasses(classStr: string, updates: Partial<BoxModelProperties>)` must:
1. Filter out existing classes belonging to the categories being updated.
2. Formulate the new classes representing the updated values.
3. Append them to the class list, maintaining other classes (like text colors, background colors, etc.) completely intact.
4. Clean up any duplicate spacing classes.
