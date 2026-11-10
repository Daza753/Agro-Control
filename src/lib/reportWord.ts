import {
  AlignmentType, BorderStyle, Document, Footer, Header,
  HeadingLevel, HorizontalPositionRelativeFrom, ImageRun,
  Packer, Paragraph, Table, TableCell, TableRow, TableOfContents,
  TextRun, TextWrappingType, VerticalAlign, VerticalPositionRelativeFrom, WidthType,
} from 'docx';
import type {
  Animal, Crop, DailyActivity, DiseaseReport, Equipment, FishPond,
  Input, Medication, MilkProduction, Vaccine,
} from './types';
import type { ReportDetailRecords, ReportExportData } from './reportExport';
import { canonicalAnimalSpecies } from './animalSpecies';
import { getAnimalDisplayName } from './animalDisplay';

const GREEN = '064E3B';
const DARK_GREEN = '123B31';
const GOLD = 'CBA84D';
const INK = '23342D';
const MUTED = '68766E';
const PALE_GREEN = 'EEF4EF';
const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1248;
const HEADER_HEIGHT_PX = PAGE_WIDTH_PX * (539 / 2362);
const FOOTER_HEIGHT_PX = PAGE_WIDTH_PX * (397 / 3964);
const LEFT_MARGIN_WIDTH_PX = PAGE_HEIGHT_PX * (141 / 2170);
const RIGHT_MARGIN_WIDTH_PX = PAGE_HEIGHT_PX * (130 / 2170);
const LABELS: Record<string, string> = {
  bovino: 'Bovino',
  equino: 'Equino',
  porcino: 'Porcino',
  caprino: 'Caprino',
  ovino: 'Ovino',
  otro: 'Otro',
  macho: 'Macho',
  hembra: 'Hembra',
  sano: 'Sano',
  enfermo: 'Enfermo',
  en_tratamiento: 'En tratamiento',
  fallecido: 'Fallecido',
  llenando: 'Llenando',
  parida: 'Parida',
  pendiente: 'Pendiente',
  aplicada: 'Aplicada',
  vencida: 'Vencida',
  antibiotico: 'Antibiótico',
  vitamina: 'Vitamina',
  desparasitante: 'Desparasitante',
  antiparasitario: 'Antiparasitario',
  fertilizante: 'Fertilizante',
  herbicida: 'Herbicida',
  insecticida: 'Insecticida',
  veneno: 'Veneno',
  semilla: 'Semilla',
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  en_reparacion: 'En reparación',
  maiz: 'Maíz',
  yuca: 'Yuca',
  frijol: 'Fríjol',
  pasto: 'Pasto',
  cosechado: 'Cosechado',
  perdido: 'Perdido',
  inactivo: 'Inactivo',
  ordeno: 'Ordeño',
  alimentacion: 'Alimentación',
  nacimiento: 'Nacimiento',
  consulta_animal: 'Consulta de animal',
  reporte_enfermedad: 'Reporte de enfermedad',
  abierto: 'Abierto',
  resuelto: 'Resuelto',
  tractor: 'Tractor',
  motosierra: 'Motosierra',
  guadana: 'Guadaña',
  bomba_fumigadora: 'Bomba fumigadora',
  herramienta_manual: 'Herramienta manual',
};

interface ReportRecordSection {
  title: string;
  records: { name: string; fields: { label: string; value: string }[] }[];
}

export interface WordPageArtwork {
  banner: Uint8Array;
  header: Uint8Array;
  footer: Uint8Array;
  leftMargin: Uint8Array;
  rightMargin: Uint8Array;
}

function floatingArtwork(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  zIndex: number,
  behindDocument = false,
) {
  return new ImageRun({
    type: 'png',
    data,
    transformation: { width, height },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(x * 9525) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(y * 9525) },
      allowOverlap: true,
      behindDocument,
      wrap: { type: TextWrappingType.NONE },
      zIndex,
    },
  });
}

function createPageHeader(artwork: WordPageArtwork, includeRightMargin: boolean) {
  const drawings = [
    floatingArtwork(artwork.leftMargin, LEFT_MARGIN_WIDTH_PX, PAGE_HEIGHT_PX, 0, 0, 1, true),
  ];
  if (includeRightMargin) {
    drawings.push(floatingArtwork(
      artwork.rightMargin,
      RIGHT_MARGIN_WIDTH_PX,
      PAGE_HEIGHT_PX,
      PAGE_WIDTH_PX - RIGHT_MARGIN_WIDTH_PX,
      0,
      1,
      true,
    ));
  }
  drawings.push(floatingArtwork(artwork.header, PAGE_WIDTH_PX, HEADER_HEIGHT_PX, 0, 0, 2));
  return new Header({ children: [new Paragraph({
    spacing: { before: 0, after: 0 },
    children: drawings,
  })] });
}

function createPageFooter(artwork: WordPageArtwork) {
  return new Footer({ children: [new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [floatingArtwork(
      artwork.footer,
      PAGE_WIDTH_PX,
      FOOTER_HEIGHT_PX,
      0,
      PAGE_HEIGHT_PX - FOOTER_HEIGHT_PX,
      3,
    )],
  })] });
}

function makeRecordSection<T>(
  title: string,
  records: T[],
  fields: (record: T) => { label: string; value: string }[],
  name: (record: T) => string,
): ReportRecordSection {
  return {
    title,
    records: records.map((record) => ({ name: name(record), fields: fields(record) })),
  };
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') return LABELS[value] ?? value;
  return String(value);
}

function detailLines(fields: [string, unknown][]) {
  return fields.map(([label, value]) => ({
    label,
    value: text(value),
  }));
}

function animalFields(animal: Animal, category: string) {
  return detailLines([
    ['Chapeta ICA', animal.ica_code],
    ['Nombre o apodo', animal.name || animal.notes?.split(/\r?\n/, 1)[0]],
    ['Categoría', category],
    ['Especie', canonicalAnimalSpecies(animal.species)],
    ['Raza', animal.breed],
    ['Sexo', animal.sex],
    ['Fecha de nacimiento', animal.birth_date],
    ['Peso (kg)', animal.weight_kg],
    ['Estado de salud', animal.health_status],
    ['Activo', animal.active],
    ['Estado de lactancia', animal.lactation_status],
    ['Número de referencia', animal.ref_number],
    ['Observaciones', animal.notes],
    ['Identificador', animal.id],
  ]);
}

function commonAnimalFields(
  animal?: Animal | MilkProduction['animal'] | Vaccine['animal'] | DailyActivity['animal'] | DiseaseReport['animal'],
  categoryLabels?: Map<string, string>,
) {
  if (!animal) return [['Animal', 'No asociado']] as [string, unknown][];
  return [
    ['Animal', getAnimalDisplayName({ ...animal, id: 'id' in animal ? animal.id : '', notes: animal.notes ?? null })],
    ['Chapeta ICA', animal.ica_code],
    ['Categoría', categoryLabels?.get(animal.category) ?? animal.category],
  ] as [string, unknown][];
}

function milkFields(record: MilkProduction, categoryLabels: Map<string, string>) {
  return detailLines([
    ['Fecha', record.date], ...commonAnimalFields(record.animal, categoryLabels),
    ['Litros mañana', record.morning_liters], ['Litros tarde', record.afternoon_liters],
    ['Total de litros', record.total_liters], ['Registrado por', record.registered_by],
    ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function vaccineFields(record: Vaccine, categoryLabels: Map<string, string>) {
  return detailLines([
    ['Vacuna', record.vaccine_name], ['Estado', record.status],
    ['Fecha programada', record.scheduled_date], ['Fecha aplicada', record.applied_date],
    ...commonAnimalFields(record.animal, categoryLabels), ['Medicamento', record.medication],
    ['Dosis', record.dose], ['Aplicada por', record.applied_by],
    ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function medicationFields(record: Medication) {
  return detailLines([
    ['Nombre', record.name], ['Tipo', record.type], ['Cantidad', record.quantity],
    ['Unidad', record.unit], ['Dosis', record.dose], ['Vencimiento', record.expiry_date],
    ['Proveedor', record.supplier], ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function inputFields(record: Input) {
  return detailLines([
    ['Nombre', record.name], ['Tipo', record.type], ['Cantidad', record.quantity],
    ['Unidad', record.unit], ['Proveedor', record.supplier], ['Fecha de compra', record.purchase_date],
    ['Precio', record.price], ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function equipmentFields(record: Equipment) {
  return detailLines([
    ['Nombre', record.name], ['Tipo', record.type], ['Estado', record.status],
    ['Último mantenimiento', record.last_maintenance_date],
    ['Próximo mantenimiento', record.next_maintenance_date],
    ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function cropFields(record: Crop) {
  return detailLines([
    ['Nombre', record.name], ['Tipo', record.type], ['Área (hectáreas)', record.area_hectares],
    ['Fecha de siembra', record.planting_date], ['Cosecha esperada', record.expected_harvest_date],
    ['Fecha de cosecha', record.harvest_date], ['Producción (kg)', record.production_kg],
    ['Estado', record.status], ['Notas de fertilización', record.fertilization_notes],
    ['Observaciones', record.notes], ['Identificador', record.id],
  ]);
}

function pondFields(record: FishPond) {
  return detailLines([
    ['Estanque', record.pond_name], ['Especie', record.species], ['Cantidad', record.quantity],
    ['Peso promedio (kg)', record.avg_weight_kg], ['Mortalidad', record.mortality],
    ['Producción (kg)', record.production_kg], ['Estado', record.status],
    ['Alimentación', record.feeding_notes], ['Observaciones', record.notes],
    ['Identificador', record.id],
  ]);
}

function activityFields(record: DailyActivity, categoryLabels: Map<string, string>) {
  return detailLines([
    ['Fecha', record.date], ['Tipo de actividad', record.activity_type],
    ['Descripción', record.description], ...commonAnimalFields(record.animal, categoryLabels),
    ['Trabajador', record.worker?.full_name], ['Observaciones', record.notes],
    ['Identificador', record.id],
  ]);
}

function diseaseFields(record: DiseaseReport, categoryLabels: Map<string, string>) {
  return detailLines([
    ['Fecha del reporte', record.report_date], ...commonAnimalFields(record.animal, categoryLabels),
    ['Síntomas', record.symptoms], ['Diagnóstico', record.diagnosis],
    ['Tratamiento', record.treatment], ['Estado', record.status],
    ['Observaciones', record.notes], ['Reportado por', record.reported_by],
    ['Identificador', record.id],
  ]);
}

function addDetailRecord(
  children: (Paragraph | Table | TableOfContents)[],
  title: string,
  fields: { label: string; value: string }[],
) {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_4,
    keepNext: true,
    spacing: { before: 120, after: 60 },
    children: [new TextRun({ text: title, bold: true, color: DARK_GREEN, size: 22 })],
  }));
  fields.forEach(({ label, value }) => children.push(new Paragraph({
    spacing: { after: 40 },
    indent: { left: 180 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: GREEN, size: 18 }),
      new TextRun({ text: value, color: INK, size: 18 }),
    ],
  })));
}

function addSection(
  children: (Paragraph | Table | TableOfContents)[],
  title: string,
  count: number,
) {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    keepNext: true,
    spacing: { before: 160, after: 90 },
    border: { bottom: { color: GOLD, size: 10, style: 'single', space: 3 } },
    children: [
      new TextRun({ text: title, bold: true, color: DARK_GREEN, size: 30 }),
      new TextRun({ text: `  ·  ${count} registro(s)`, color: MUTED, size: 18 }),
    ],
  }));
}

function animalCountSummary(records: ReportDetailRecords) {
  const counts = new Map<string, number>();
  records.animals.forEach((animal) => {
    const species = canonicalAnimalSpecies(animal.species);
    counts.set(species, (counts.get(species) ?? 0) + 1);
  });
  return counts;
}

export async function exportReportWord(
  summary: ReportExportData,
  farmName: string,
  records: ReportDetailRecords,
  artwork: WordPageArtwork,
) {
  const generatedAt = new Date();
  const categoryLabels = new Map(records.animalCategories.map((category) => [category.code, category.label]));
  const children: (Paragraph | Table | TableOfContents)[] = [];
  const coverWidth = PAGE_WIDTH_PX - LEFT_MARGIN_WIDTH_PX;
  const bannerWidth = coverWidth * (725 / 2170) * 0.66;
  const bannerHeight = PAGE_HEIGHT_PX - HEADER_HEIGHT_PX - FOOTER_HEIGHT_PX;
  const coverTextWidth = coverWidth - bannerWidth;
  const noBorders = {
    top: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
    insideVertical: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
  };
  const coverText = [
    new Paragraph({
      children: [new TextRun({ text: 'FINCACONTROL', font: 'Arial', bold: true, color: GREEN, size: 18, characterSpacing: 30 })],
      spacing: { after: 30 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'GESTIÓN AGRÍCOLA Y GANADERA', font: 'Times New Roman', color: MUTED, size: 14 })],
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'REPORTE GENERAL DE LA FINCA', font: 'Arial', bold: true, color: GOLD, size: 15 })],
      spacing: { after: 170 },
    }),
    new Paragraph({
      children: [new TextRun({ text: farmName, font: 'Arial', bold: true, color: DARK_GREEN, size: 34 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generado el ${generatedAt.toLocaleDateString('es-CO')}`, font: 'Times New Roman', color: MUTED, size: 19 })],
      spacing: { after: 180 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `${records.animals.length} animales · ${records.milkProduction.length} producciones · ${records.vaccines.length} vacunas`,
        font: 'Times New Roman',
        color: INK,
        size: 18,
      })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Creado por Oscar David Vega Daza', font: 'Times New Roman', bold: true, color: GREEN, size: 17 })],
    }),
  ];
  const coverTable = new Table({
    width: { size: Math.round(coverWidth * 15), type: WidthType.DXA },
    columnWidths: [Math.round(coverTextWidth * 15), Math.round(bannerWidth * 15)],
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: Math.round(coverTextWidth * 15), type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 0, bottom: 0, left: 220, right: 180 },
          children: coverText,
        }),
        new TableCell({
          width: { size: Math.round(bannerWidth * 15), type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          shading: { fill: DARK_GREEN },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({
              type: 'png',
              data: artwork.banner,
              transformation: { width: bannerWidth, height: bannerHeight },
            })],
          })],
        }),
      ],
    })],
    borders: noBorders,
  });
  const coverChildren = [coverTable];
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Índice', bold: true, color: DARK_GREEN, size: 30 })],
      spacing: { after: 100 },
    }),
    new TableOfContents('Índice del reporte', {
      headingStyleRange: '1-4',
      hyperlink: true,
      pageNumbersEntryLevelsRange: '1-4',
    }),
  );

  addSection(children, 'Resumen de la finca', 1);
  const speciesCounts = animalCountSummary(records);
  const summaryLines: [string, unknown][] = [
    ['Producción de leche · últimos 30 días (L)', summary.milkTotal.toFixed(1)],
    ['Registros de ordeño · últimos 30 días', summary.milkRecords],
    ...Array.from(speciesCounts, ([species, count]) => [`Animales · ${text(species)}`, count] as [string, unknown]),
    ['Vacunas pendientes', records.vaccines.filter((item) => item.status === 'pendiente').length],
    ['Vacunas aplicadas', records.vaccines.filter((item) => item.status === 'aplicada').length],
    ['Medicamentos', records.medications.length],
    ['Insumos', records.inputs.length],
    ['Cultivos activos', records.crops.filter((item) => item.status === 'activo').length],
    ['Cultivos cosechados', records.crops.filter((item) => item.status === 'cosechado').length],
    ['Estanques activos', records.fishPonds.filter((item) => item.status === 'activo').length],
    ['Equipos', records.equipment.length],
  ];
  summaryLines.forEach(([label, value]) => children.push(new Paragraph({
    spacing: { after: 75 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: GREEN, size: 20 }),
      new TextRun({ text: text(value), color: INK, size: 20 }),
    ],
  })));

  const sortedAnimals = [...records.animals].sort((a, b) => (
    canonicalAnimalSpecies(a.species).localeCompare(canonicalAnimalSpecies(b.species), 'es')
    || (categoryLabels.get(a.category) ?? a.category).localeCompare(categoryLabels.get(b.category) ?? b.category, 'es')
    || a.ica_code.localeCompare(b.ica_code, 'es', { numeric: true })
  ));
  let currentSpecies = '';
  let currentCategory = '';
  addSection(children, 'Registro completo de animales', sortedAnimals.length);
  sortedAnimals.forEach((animal) => {
    const species = canonicalAnimalSpecies(animal.species);
    const category = categoryLabels.get(animal.category) ?? animal.category ?? 'Sin categoría';
    if (species !== currentSpecies) {
      currentSpecies = species;
      currentCategory = '';
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: text(species), bold: true, color: GREEN, size: 25 })],
      }));
    }
    if (category !== currentCategory) {
      currentCategory = category;
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        keepNext: true,
        spacing: { before: 70, after: 50 },
        children: [new TextRun({ text: category, bold: true, color: MUTED, size: 21 })],
      }));
    }
    addDetailRecord(
      children,
      `${getAnimalDisplayName(animal)} · ${animal.ica_code || 'Sin chapeta'}`,
      animalFields(animal, category),
    );
  });

  const sections: ReportRecordSection[] = [
    makeRecordSection('Producción de leche', [...records.milkProduction].sort((a, b) => b.date.localeCompare(a.date)),
      (item) => milkFields(item, categoryLabels),
      (item) => `Ordeño · ${item.date} · ${item.animal?.name || item.animal?.ica_code || ''}`),
    makeRecordSection('Vacunas', [...records.vaccines].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)),
      (item) => vaccineFields(item, categoryLabels),
      (item) => `${item.vaccine_name} · ${item.animal?.name || item.animal?.ica_code || 'Sin animal'}`),
    makeRecordSection('Medicamentos', records.medications, medicationFields, (item) => item.name),
    makeRecordSection('Insumos', records.inputs, inputFields, (item) => item.name),
    makeRecordSection('Equipos', records.equipment, equipmentFields, (item) => item.name),
    makeRecordSection('Cultivos', [...records.crops].sort((a, b) => a.name.localeCompare(b.name, 'es')), cropFields, (item) => item.name),
    makeRecordSection('Piscicultura', [...records.fishPonds].sort((a, b) => a.pond_name.localeCompare(b.pond_name, 'es')), pondFields, (item) => item.pond_name),
    makeRecordSection('Actividades', [...records.activities].sort((a, b) => b.date.localeCompare(a.date)),
      (item) => activityFields(item, categoryLabels),
      (item) => `${item.date} · ${item.description}`),
    makeRecordSection('Enfermedades', [...records.diseases].sort((a, b) => b.report_date.localeCompare(a.report_date)),
      (item) => diseaseFields(item, categoryLabels),
      (item) => `${item.report_date} · ${item.animal?.name || item.animal?.ica_code || 'Reporte'}`),
  ];

  sections.forEach(({ title, records: sectionRecords }) => {
    addSection(children, title, sectionRecords.length);
    sectionRecords.forEach(({ name, fields }) => {
      children.push(new Paragraph({
        keepNext: true,
        spacing: { before: 90, after: 50 },
        shading: { fill: PALE_GREEN },
        children: [new TextRun({ text: name, bold: true, color: DARK_GREEN, size: 21 })],
      }));
      fields.forEach(({ label, value }) => children.push(new Paragraph({
        spacing: { after: 35 },
        indent: { left: 180 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, color: GREEN, size: 18 }),
          new TextRun({ text: value, color: INK, size: 18 }),
        ],
      })));
    });
  });

  const coverHeader = createPageHeader(artwork, false);
  const innerHeader = createPageHeader(artwork, true);
  const footer = createPageFooter(artwork);
  const document = new Document({
    creator: 'Oscar David Vega Daza',
    title: `Reporte general · ${farmName}`,
    subject: 'Reporte completo de la finca',
    features: { updateFields: true },
    sections: [{
      properties: {
        page: {
          margin: {
            top: Math.round(HEADER_HEIGHT_PX * 15),
            bottom: Math.round(FOOTER_HEIGHT_PX * 15),
            left: Math.round(LEFT_MARGIN_WIDTH_PX * 15),
            right: 0,
            header: 0,
            footer: 0,
          },
          size: { width: 12240, height: 18720 },
        },
      },
      headers: { default: coverHeader },
      footers: { default: footer },
      children: coverChildren,
    }, {
      properties: {
        page: {
          margin: {
            top: Math.round(HEADER_HEIGHT_PX * 15),
            bottom: Math.round(FOOTER_HEIGHT_PX * 15),
            left: Math.round(LEFT_MARGIN_WIDTH_PX * 15),
            right: Math.round(RIGHT_MARGIN_WIDTH_PX * 15),
            header: 0,
            footer: 0,
          },
          size: { width: 12240, height: 18720 },
        },
      },
      headers: { default: innerHeader },
      footers: { default: footer },
      children,
    }],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `reporte_finca_${generatedAt.toISOString().slice(0, 10)}.docx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
