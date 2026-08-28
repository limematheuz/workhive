# WorkHive UI control standard

All interactive form controls use the local shadcn primitives in `frontend/src/components/ui`:

- `Input` for text, numbers, email and read-only values.
- `Textarea` for multiline text.
- `Select` for dropdowns.
- `Checkbox` for binary choices.
- `DatePicker` for dates, composed from shadcn `InputGroup`, `Popover` and `Calendar`.
- `Button` for every action, including icon-only actions.
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead` and `TableCell`
  for semantic tabular data.

Their shared WorkHive visual identity lives in `formControlSurfaceClassName` in
`frontend/src/components/ui/control-styles.ts`. It defines the control surface,
border, text color, focus state and light/dark behavior. Do not add white dialog
field overrides or create a new form-control primitive. Compose these components
and use size/layout classes only where the view needs them.

The table composition is deliberately the local shadcn `Table` primitive. Keep
the existing WorkHive spacing, muted header and responsive wrapper in the view;
do not introduce another table package or a one-off HTML table.

When migrating a view, replace native form elements with the primitives above and
remove its duplicate control styling in the same slice. Validate both themes
before expanding the standard to the next view.
