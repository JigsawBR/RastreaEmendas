import type { AmendmentSource } from "../lib/sources";
import { amendmentSourceOptions } from "../lib/amendment-source";
export default function SourceSelector({
  value,
  onChange,
}: {
  value: AmendmentSource;
  onChange: (source: AmendmentSource) => void;
}) {
  return (
    <label className="field">
      Origem da emenda
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AmendmentSource)}
      >
        {amendmentSourceOptions.map((source) => (
          <option key={source.id} value={source.id}>
            {source.label}
          </option>
        ))}
      </select>
    </label>
  );
}
