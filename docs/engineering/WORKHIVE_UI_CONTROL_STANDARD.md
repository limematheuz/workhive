# WorkHive UI control standard

All interactive form controls use the local shadcn primitives in `frontend/src/components/ui`:

- `Input` for text, numbers, email and read-only values.
- `Textarea` for multiline text.
- `Select` for dropdowns.
- `Checkbox` for binary choices.
- `DatePicker` for dates, composed from shadcn `InputGroup`, `Popover` and `Calendar`.
- `Button` for every action, including icon-only actions.

Their shared WorkHive visual identity lives in `formControlSurfaceClassName` in
`frontend/src/components/ui/control-styles.ts`. It defines the control surface,
border, text color, focus state and light/dark behavior. Do not add white dialog
field overrides or create a new form-control primitive. Compose these components
and use size/layout classes only where the view needs them.

When migrating a view, replace native form elements with the primitives above and
remove its duplicate control styling in the same slice. Validate both themes
before expanding the standard to the next view.
