import type { Geography, MunicipalityMapItem } from "./api";

// One source per indicator: federal sources are complementary and must not be
// summed, and a planned value is not execution.
export type Indicator = { label: string; unit: string; ramp: "federal" | "state"; value: (item: MunicipalityMapItem) => number; note: string };
export const indicators: Record<string, Indicator> = {
  estadual: {
    label: "Estadual · transferido ao município", unit: "transferidos", ramp: "state",
    value: (item) => item.estadual.valorTransferido,
    note: "Empenho líquido das notas de transferência à prefeitura ou a fundo municipal (CODATA). Recursos a entidades sediadas na cidade não entram.",
  },
  planos: {
    label: "Federal · planos especiais (previsto)", unit: "previstos", ramp: "federal",
    value: (item) => item.federal.valorPlanos,
    note: "Valor previsto nos planos de ação das transferências especiais (Transferegov). É previsão, não execução.",
  },
  alocacoes: {
    label: "Federal · alocações por município", unit: "empenhados", ramp: "federal",
    value: (item) => item.federal.empenhado,
    note: "Empenhado nas alocações da CGU que informam o município. A maior parte do valor federal está registrada como PARAÍBA (UF) e não aparece aqui.",
  },
  despesa: {
    label: "Federal · execução mensal", unit: "empenhados", ramp: "federal",
    value: (item) => item.federal.despesaEmpenhado,
    note: "Despesa mensal dos arquivos abertos com autor de emenda, recortada pelo ano do gasto.",
  },
};

const RAMP_STEPS = 5;
// Fewer classes (repeated values) still span the whole ramp, light to dark.
export const rampStep = (cls: number, classes: number) =>
  classes <= 1 ? RAMP_STEPS : 1 + Math.round(((cls - 1) * (RAMP_STEPS - 1)) / (classes - 1));

/** Projects the IBGE mesh into the 1000 × 540 viewBox shared by every map. */
export function paths(data: Geography) {
  const polygons = data.features.map(feature => ({ feature, polygons: feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates }));
  const positions = polygons.flatMap(shape => shape.polygons.flat(2));
  const longitude = positions.map(point => point[0]);
  const latitude = positions.map(point => -point[1]);
  const left = Math.min(...longitude), top = Math.min(...latitude);
  const width = Math.max(...longitude) - left, height = Math.max(...latitude) - top;
  const scale = Math.min(960 / width, 500 / height);
  const dx = (1000 - width * scale) / 2, dy = (540 - height * scale) / 2;
  return polygons.map(({ feature, polygons: rings }) => {
    // Centre of the bounding box: where a marker goes for a city too small to see.
    const points = rings.flat(2);
    const xs = points.map(([x]) => (x - left) * scale + dx), ys = points.map(([, y]) => (-y - top) * scale + dy);
    return {
      code: feature.properties.code, name: feature.properties.name,
      cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      path: rings.map(polygon => polygon.map(ring => ring.map(([x, y], i) => `${i ? "L" : "M"}${((x - left) * scale + dx).toFixed(2)},${((-y - top) * scale + dy).toFixed(2)}`).join(" ") + " Z").join(" ")).join(" "),
    };
  });
}
