import type ExcelJS from 'exceljs';
import type {
  Animal, Crop, DailyActivity, DiseaseReport, Equipment, FishPond,
  Input, Medication, MilkProduction, Vaccine,
} from './types';
import { canonicalAnimalSpecies } from './animalSpecies';

export interface ReportExportData {
  milkTotal: number;
  milkRecords: number;
  animalsBySpecies: { species: string; count: number }[];
  pendingVaccines: number;
  appliedVaccines: number;
  medications: { name: string; quantity: number; unit: string; type: string }[];
  inputs: { name: string; quantity: number; unit: string; type: string }[];
  activeCrops: number;
  harvestedCrops: number;
  activePonds: number;
  equipmentByStatus: { status: string; count: number }[];
}

export interface ReportDetailRecords {
  animals: Animal[];
  animalCategories: { code: string; label: string }[];
  milkProduction: MilkProduction[];
  vaccines: Vaccine[];
  medications: Medication[];
  inputs: Input[];
  equipment: Equipment[];
  crops: Crop[];
  fishPonds: FishPond[];
  activities: DailyActivity[];
  diseases: DiseaseReport[];
}

const brandGreen = '064E3B';
const lightGreen = 'EAF3ED';
const borderColor = 'D9E4DD';
const equipmentLabels: Record<string, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  en_reparacion: 'En reparación',
};
const medicationLabels: Record<string, string> = {
  antibiotico: 'Antibiótico',
  vitamina: 'Vitamina',
  desparasitante: 'Desparasitante',
  antiparasitario: 'Antiparasitario',
  otro: 'Otro',
};
const inputLabels: Record<string, string> = {
  fertilizante: 'Fertilizante',
  herbicida: 'Herbicida',
  insecticida: 'Insecticida',
  veneno: 'Veneno',
  semilla: 'Semilla',
  otro: 'Otro',
};
const speciesLabels: Record<string, string> = {
  bovino: 'Bovinos',
  equino: 'Equinos',
  porcino: 'Porcinos',
  caprino: 'Caprinos',
  ovino: 'Ovinos',
  otro: 'Otros',
  vaca: 'Bovinos',
  toro: 'Bovinos',
  ternero: 'Bovinos',
  caballo: 'Equinos',
  cerdo: 'Porcinos',
  chivo: 'Caprinos',
  oveja: 'Ovinos',
};
const sexLabels: Record<string, string> = { macho: 'Macho', hembra: 'Hembra' };
const healthLabels: Record<string, string> = {
  sano: 'Sano',
  enfermo: 'Enfermo',
  en_tratamiento: 'En tratamiento',
  fallecido: 'Fallecido',
};
const lactationLabels: Record<string, string> = { llenando: 'Llenando', parida: 'Parida' };
const vaccineStatusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  aplicada: 'Aplicada',
  vencida: 'Vencida',
};
const cropStatusLabels: Record<string, string> = {
  activo: 'Activo',
  cosechado: 'Cosechado',
  perdido: 'Perdido',
};
const fishStatusLabels: Record<string, string> = {
  activo: 'Activo',
  cosechado: 'Cosechado',
  inactivo: 'Inactivo',
};
const activityTypeLabels: Record<string, string> = {
  ordeno: 'Ordeño',
  alimentacion: 'Alimentación',
  nacimiento: 'Nacimiento',
  consulta_animal: 'Consulta de animal',
  reporte_enfermedad: 'Reporte de enfermedad',
  otro: 'Otro',
};
const diseaseStatusLabels: Record<string, string> = {
  abierto: 'Abierto',
  en_tratamiento: 'En tratamiento',
  resuelto: 'Resuelto',
};
const equipmentTypeLabels: Record<string, string> = {
  motosierra: 'Motosierra',
  guadana: 'Guadaña',
  bomba_fumigadora: 'Bomba fumigadora',
  tractor: 'Tractor',
  herramienta_manual: 'Herramienta manual',
  otro: 'Otro',
};
const cropTypeLabels: Record<string, string> = {
  maiz: 'Maíz',
  yuca: 'Yuca',
  frijol: 'Fríjol',
  pasto: 'Pasto',
  otro: 'Otro',
};

function labelOf(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) return '';
  return labels[value] ?? value;
}

function detailTable(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  widths: number[],
  options: { categoryColumn?: number } = {},
) {
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  worksheet.columns = widths.map((width) => ({ width }));
  worksheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `${title.toLocaleUpperCase('es-CO')} · ${rows.length} REGISTRO(S)`;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandGreen } };
  titleCell.font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.alignment = { vertical: 'middle' };
  worksheet.getRow(1).height = 32;
  worksheet.mergeCells(2, 1, 2, headers.length);
  worksheet.getCell(2, 1).value = 'FincaControl · Reporte generado desde la información registrada';
  worksheet.getCell(2, 1).font = { name: 'Aptos', size: 9, italic: true, color: { argb: '64746D' } };
  worksheet.getRow(3).height = 8;

  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } };
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: brandGreen } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'A7C6B3' } } };
  });
  headerRow.height = 30;
  worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: headers.length } };

  rows.forEach((values, rowIndex) => {
    const row = worksheet.getRow(5 + rowIndex);
    values.forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = value;
      cell.font = { name: 'Aptos', size: 10, color: { argb: '263B32' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFF' : 'F5F8F6' },
      };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: borderColor } } };
    });
    if (options.categoryColumn !== undefined) {
      const previousCategory = rowIndex > 0 ? rows[rowIndex - 1][options.categoryColumn] : undefined;
      const currentCategory = values[options.categoryColumn];
      if (rowIndex === 0 || currentCategory !== previousCategory) {
        row.getCell(options.categoryColumn + 1).font = {
          name: 'Aptos',
          size: 10,
          bold: true,
          color: { argb: brandGreen },
        };
        row.getCell(1).border = {
          top: { style: 'thin', color: { argb: '9DBBA8' } },
          bottom: { style: 'hair', color: { argb: borderColor } },
        };
      }
    }
    row.height = 21;
  });
  return worksheet;
}


function setSectionTitle(
  worksheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  title: string,
) {
  worksheet.mergeCells(row, startColumn, row, endColumn);
  const cell = worksheet.getCell(row, startColumn);
  cell.value = title.toLocaleUpperCase('es-CO');
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandGreen } };
  cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  cell.alignment = { vertical: 'middle' };
  worksheet.getRow(row).height = 23;
}

function addTable(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startColumn: number,
  endColumn: number,
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  setSectionTitle(worksheet, startRow, startColumn, endColumn, title);
  const headerRow = worksheet.getRow(startRow + 1);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(startColumn + index);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } };
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: brandGreen } };
    cell.alignment = { vertical: 'middle', horizontal: index === 0 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: borderColor } } };
  });
  headerRow.height = 21;

  rows.forEach((values, rowIndex) => {
    const row = worksheet.getRow(startRow + 2 + rowIndex);
    values.forEach((value, index) => {
      const cell = row.getCell(startColumn + index);
      cell.value = value;
      cell.font = { name: 'Aptos', size: 10, color: { argb: '263B32' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFF' : 'F5F8F6' },
      };
      cell.alignment = { vertical: 'middle', horizontal: index === 0 ? 'left' : 'right' };
      cell.border = { bottom: { style: 'hair', color: { argb: borderColor } } };
    });
    row.height = 21;
  });
}

function setMetric(
  worksheet: ExcelJS.Worksheet,
  startColumn: number,
  endColumn: number,
  label: string,
  value: string | number,
  fill: string,
) {
  worksheet.mergeCells(5, startColumn, 5, endColumn);
  worksheet.mergeCells(6, startColumn, 7, endColumn);
  for (let rowNumber = 5; rowNumber <= 7; rowNumber += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      worksheet.getCell(rowNumber, column).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      };
      worksheet.getCell(rowNumber, column).border = {
        top: { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
      };
    }
  }
  const labelCell = worksheet.getCell(5, startColumn);
  labelCell.value = label;
  labelCell.font = { name: 'Aptos', size: 10, color: { argb: '61736A' } };
  labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  const valueCell = worksheet.getCell(6, startColumn);
  valueCell.value = value;
  valueCell.font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: brandGreen } };
  valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportReportCsv(data: ReportExportData, farmName: string) {
  const generatedAt = new Date();
  const rows: (string | number)[][] = [
    ['Finca', 'Sección', 'Concepto', 'Valor', 'Unidad', 'Detalle'],
    [farmName, 'Reporte', 'Fecha de generación', generatedAt.toLocaleDateString('es-CO'), '', ''],
    [farmName, 'Producción de leche', 'Total últimos 30 días', data.milkTotal, 'L', ''],
    [farmName, 'Producción de leche', 'Registros de ordeño', data.milkRecords, '', ''],
    ...data.animalsBySpecies.map((animal) => [
      farmName, 'Animales', speciesLabels[animal.species] ?? animal.species, animal.count, '', '',
    ]),
    [farmName, 'Vacunas', 'Pendientes', data.pendingVaccines, '', ''],
    [farmName, 'Vacunas', 'Aplicadas', data.appliedVaccines, '', ''],
    ...data.medications.map((medication) => [
      farmName, 'Medicamentos', medication.name, medication.quantity, medication.unit,
      medicationLabels[medication.type] ?? medication.type,
    ]),
    ...data.inputs.map((input) => [
      farmName, 'Insumos', input.name, input.quantity, input.unit, inputLabels[input.type] ?? input.type,
    ]),
    [farmName, 'Cultivos', 'Activos', data.activeCrops, '', ''],
    [farmName, 'Cultivos', 'Cosechados', data.harvestedCrops, '', ''],
    [farmName, 'Piscicultura', 'Estanques activos', data.activePonds, '', ''],
    ...data.equipmentByStatus.map((equipment) => [
      farmName, 'Equipos', equipmentLabels[equipment.status] ?? equipment.status, equipment.count, '', '',
    ]),
  ];
  const contents = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  downloadBlob(
    new Blob([contents], { type: 'text/csv;charset=utf-8' }),
    `reporte_finca_${generatedAt.toISOString().slice(0, 10)}.csv`,
  );
}

export async function exportReportXlsx(
  data: ReportExportData,
  farmName: string,
  records: ReportDetailRecords,
  logoBase64?: string,
) {
  const { Workbook } = await import('exceljs');
  const generatedAt = new Date();
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const speciesCounts = new Map<string, number>();
  records.animals.filter((animal) => animal.active).forEach((animal) => {
    const species = canonicalAnimalSpecies(animal.species);
    speciesCounts.set(species, (speciesCounts.get(species) ?? 0) + 1);
  });
  const equipmentCounts = new Map<string, number>();
  records.equipment.forEach((item) => {
    equipmentCounts.set(item.status, (equipmentCounts.get(item.status) ?? 0) + 1);
  });
  const fullData: ReportExportData = {
    ...data,
    milkTotal: records.milkProduction
      .filter((record) => record.date >= monthAgo)
      .reduce((sum, record) => sum + Number(record.total_liters ?? 0), 0),
    milkRecords: records.milkProduction.filter((record) => record.date >= monthAgo).length,
    animalsBySpecies: Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count),
    pendingVaccines: records.vaccines.filter((vaccine) => vaccine.status === 'pendiente').length,
    appliedVaccines: records.vaccines.filter((vaccine) => vaccine.status === 'aplicada').length,
    medications: records.medications,
    inputs: records.inputs,
    activeCrops: records.crops.filter((crop) => crop.status === 'activo').length,
    harvestedCrops: records.crops.filter((crop) => crop.status === 'cosechado').length,
    activePonds: records.fishPonds.filter((pond) => pond.status === 'activo').length,
    equipmentByStatus: Array.from(equipmentCounts, ([status, count]) => ({ status, count })),
  };
  const workbook = new Workbook();
  workbook.creator = 'FincaControl';
  workbook.subject = 'Reporte general de la finca';
  workbook.title = `Reporte general - ${farmName}`;
  workbook.created = generatedAt;

  const worksheet = workbook.addWorksheet('Resumen de finca', {
    properties: { defaultRowHeight: 21 },
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  worksheet.columns = [
    { width: 28 }, { width: 16 }, { width: 16 }, { width: 17 },
    { width: 28 }, { width: 16 }, { width: 16 }, { width: 18 },
  ];
  worksheet.mergeCells('B1:H2');
  worksheet.mergeCells('B3:H3');
  for (let row = 1; row <= 3; row += 1) {
    worksheet.getRow(row).height = row === 1 ? 34 : 24;
    for (let column = 1; column <= 8; column += 1) {
      worksheet.getCell(row, column).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: brandGreen },
      };
    }
  }
  worksheet.getCell('B1').value = `FINCACONTROL  ·  REPORTE GENERAL DE LA FINCA\n${farmName}`;
  worksheet.getCell('B1').font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: 'FFFFFF' } };
  worksheet.getCell('B1').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
  worksheet.getCell('B1').border = {
    bottom: { style: 'medium', color: { argb: 'D89A19' } },
  };
  worksheet.getCell('B3').value = `Generado: ${generatedAt.toLocaleDateString('es-CO')}  ·  Producción: últimos 30 días`;
  worksheet.getCell('B3').font = { name: 'Aptos', size: 10, color: { argb: 'D2E3D9' } };
  worksheet.getCell('B3').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  if (logoBase64) {
    const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
    worksheet.addImage(imageId, {
      tl: { col: 0.18, row: 0.22 },
      ext: { width: 80, height: 80 },
    });
  }

  setMetric(worksheet, 1, 2, 'Producción de leche · 30 días', `${fullData.milkTotal.toFixed(1)} L`, 'F3FAF6');
  setMetric(worksheet, 3, 4, 'Animales activos', fullData.animalsBySpecies.reduce((sum, item) => sum + item.count, 0), 'F6F8FF');
  setMetric(worksheet, 5, 6, 'Vacunas pendientes', fullData.pendingVaccines, 'FFF9EB');
  setMetric(worksheet, 7, 8, 'Cultivos activos', fullData.activeCrops, 'F4F8EF');

  const milkRows: (string | number)[][] = [
    ['Total producido', Number(fullData.milkTotal.toFixed(2)), 'L'],
    ['Registros de ordeño', fullData.milkRecords, ''],
  ];
  const animalRows = fullData.animalsBySpecies.map((animal) => [
    speciesLabels[animal.species] ?? animal.species, animal.count,
  ]);
  let row = 9;
  addTable(worksheet, row, 1, 4, 'Producción de leche · últimos 30 días', ['Indicador', 'Valor', 'Unidad'], milkRows);
  addTable(worksheet, row, 5, 8, 'Animales activos por especie', ['Especie', 'Cantidad'], animalRows);
  row += Math.max(milkRows.length, animalRows.length, 2) + 4;

  const vaccineRows: (string | number)[][] = [
    ['Pendientes', fullData.pendingVaccines],
    ['Aplicadas', fullData.appliedVaccines],
  ];
  const medicationRows = fullData.medications.map((medication) => [
    medication.name,
    medication.quantity,
    medication.unit,
    medicationLabels[medication.type] ?? medication.type,
  ]);
  addTable(worksheet, row, 1, 4, 'Vacunas', ['Estado', 'Cantidad'], vaccineRows);
  addTable(worksheet, row, 5, 8, 'Medicamentos en inventario', ['Nombre', 'Cantidad', 'Unidad', 'Tipo'], medicationRows);
  row += Math.max(vaccineRows.length, medicationRows.length, 2) + 4;

  const inputRows = fullData.inputs.map((input) => [
    input.name,
    input.quantity,
    input.unit,
    inputLabels[input.type] ?? input.type,
  ]);
  const cropRows: (string | number)[][] = [
    ['Activos', fullData.activeCrops],
    ['Cosechados', fullData.harvestedCrops],
  ];
  addTable(worksheet, row, 1, 4, 'Insumos en inventario', ['Nombre', 'Cantidad', 'Unidad', 'Tipo'], inputRows);
  addTable(worksheet, row, 5, 8, 'Estado de cultivos', ['Estado', 'Cantidad'], cropRows);
  row += Math.max(inputRows.length, cropRows.length, 2) + 4;

  const pondRows: (string | number)[][] = [
    ['Estanques activos', fullData.activePonds],
  ];
  const equipmentRows = fullData.equipmentByStatus.map((equipment) => [
    equipmentLabels[equipment.status] ?? equipment.status,
    equipment.count,
  ]);
  addTable(worksheet, row, 1, 4, 'Piscicultura', ['Indicador', 'Cantidad'], pondRows);
  addTable(worksheet, row, 5, 8, 'Equipos por estado', ['Estado', 'Cantidad'], equipmentRows);
  row += Math.max(pondRows.length, equipmentRows.length, 2) + 4;

  worksheet.mergeCells(`A${row}:H${row}`);
  worksheet.getCell(`A${row}`).value = 'FincaControl · Reporte generado desde la información registrada';
  worksheet.getCell(`A${row}`).font = { name: 'Aptos', size: 9, italic: true, color: { argb: '829087' } };
  worksheet.getCell(`A${row}`).alignment = { horizontal: 'left' };
  worksheet.pageSetup.printArea = `A1:H${row}`;

  const categoryLabels = new Map(records.animalCategories.map((category) => [category.code, category.label]));
  const animalDetails = [...records.animals]
    .map((animal) => ({
      animal,
      category: categoryLabels.get(animal.category) ?? animal.category ?? '',
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'es')
      || a.animal.ica_code.localeCompare(b.animal.ica_code, 'es', { numeric: true }));
  detailTable(
    workbook,
    'Animales',
    'Animales · agrupados por categoría y chapeta ICA',
    ['Chapeta ICA', 'Nombre / apodo', 'Categoría', 'Especie', 'Raza', 'Sexo', 'Nacimiento', 'Peso (kg)', 'Estado de salud', 'Activo', 'Lactancia', 'N.º referencia', 'Observaciones', 'ID'],
    animalDetails.map(({ animal, category }) => [
      animal.ica_code,
      animal.name,
      category,
      labelOf(speciesLabels, animal.species),
      animal.breed,
      labelOf(sexLabels, animal.sex),
      animal.birth_date ?? '',
      animal.weight_kg ?? '',
      labelOf(healthLabels, animal.health_status),
      animal.active ? 'Sí' : 'No',
      labelOf(lactationLabels, animal.lactation_status),
      animal.ref_number ?? '',
      animal.notes ?? '',
      animal.id,
    ]),
    [16, 22, 22, 16, 20, 12, 14, 14, 19, 10, 14, 14, 36, 38],
    { categoryColumn: 2 },
  );

  detailTable(
    workbook,
    'Producción leche',
    'Producción de leche · historial completo',
    ['Fecha', 'Chapeta ICA', 'Animal', 'Categoría', 'Mañana (L)', 'Tarde (L)', 'Total (L)', 'Registrado por (ID)', 'Observaciones', 'ID'],
    [...records.milkProduction]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((record) => [
        record.date,
        record.animal?.ica_code ?? '',
        record.animal?.name ?? '',
        categoryLabels.get(record.animal?.category ?? '') ?? record.animal?.category ?? '',
        Number(record.morning_liters),
        Number(record.afternoon_liters),
        Number(record.total_liters),
        record.registered_by ?? '',
        record.notes ?? '',
        record.id,
      ]),
    [14, 16, 22, 20, 16, 16, 14, 38, 36, 38],
  );

  detailTable(
    workbook,
    'Vacunas',
    'Vacunas · historial completo',
    ['Fecha programada', 'Fecha aplicada', 'Chapeta ICA', 'Animal', 'Vacuna', 'Medicamento', 'Dosis', 'Estado', 'Aplicada por (ID)', 'Observaciones', 'ID'],
    [...records.vaccines]
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
      .map((vaccine) => [
        vaccine.scheduled_date,
        vaccine.applied_date ?? '',
        vaccine.animal?.ica_code ?? '',
        vaccine.animal?.name ?? '',
        vaccine.vaccine_name,
        vaccine.medication ?? '',
        vaccine.dose ?? '',
        labelOf(vaccineStatusLabels, vaccine.status),
        vaccine.applied_by ?? '',
        vaccine.notes ?? '',
        vaccine.id,
      ]),
    [16, 16, 16, 22, 24, 24, 16, 16, 38, 36, 38],
  );

  const inventoryRows: (string | number)[][] = [
    ...records.medications.map((item) => [
      'Medicamento', item.name, labelOf(medicationLabels, item.type), item.quantity, item.unit,
      item.expiry_date ?? '', item.supplier ?? '', item.dose ?? '', item.notes ?? '', item.id,
    ]),
    ...records.inputs.map((item) => [
      'Insumo', item.name, labelOf(inputLabels, item.type), item.quantity, item.unit,
      item.purchase_date ?? '', item.supplier ?? '', item.price ?? '', item.notes ?? '', item.id,
    ]),
    ...records.equipment.map((item) => [
      'Equipo', item.name, labelOf(equipmentTypeLabels, item.type), '', '',
      item.next_maintenance_date ?? '', '', labelOf(equipmentLabels, item.status),
      item.notes ?? '', item.id,
    ]),
  ];
  detailTable(
    workbook,
    'Inventario',
    'Inventario · medicamentos, insumos y equipos',
    ['Tipo de registro', 'Nombre', 'Tipo / estado', 'Cantidad', 'Unidad', 'Vencimiento / fecha', 'Proveedor', 'Dosis / precio / estado', 'Observaciones', 'ID'],
    inventoryRows,
    [20, 26, 24, 14, 14, 22, 24, 25, 36, 38],
  );

  detailTable(
    workbook,
    'Cultivos',
    'Cultivos · historial completo',
    ['Nombre', 'Tipo', 'Área (ha)', 'Siembra', 'Cosecha esperada', 'Cosecha', 'Producción (kg)', 'Estado', 'Notas de fertilización', 'Observaciones', 'ID'],
    [...records.crops]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((crop) => [
        crop.name, labelOf(cropTypeLabels, crop.type), crop.area_hectares ?? '',
        crop.planting_date ?? '', crop.expected_harvest_date ?? '', crop.harvest_date ?? '',
        crop.production_kg ?? '', labelOf(cropStatusLabels, crop.status),
        crop.fertilization_notes ?? '', crop.notes ?? '', crop.id,
      ]),
    [26, 18, 14, 16, 20, 16, 18, 16, 36, 36, 38],
  );

  detailTable(
    workbook,
    'Piscicultura',
    'Piscicultura · historial completo',
    ['Estanque', 'Especie', 'Cantidad', 'Peso promedio (kg)', 'Mortalidad', 'Producción (kg)', 'Estado', 'Alimentación', 'Observaciones', 'ID'],
    [...records.fishPonds]
      .sort((a, b) => a.pond_name.localeCompare(b.pond_name, 'es'))
      .map((pond) => [
        pond.pond_name, pond.species, pond.quantity, pond.avg_weight_kg ?? '',
        pond.mortality, pond.production_kg ?? '', labelOf(fishStatusLabels, pond.status),
        pond.feeding_notes ?? '', pond.notes ?? '', pond.id,
      ]),
    [26, 22, 14, 20, 14, 18, 16, 36, 36, 38],
  );

  detailTable(
    workbook,
    'Actividades',
    'Actividades · historial completo',
    ['Fecha', 'Tipo', 'Actividad', 'Chapeta ICA', 'Animal', 'Trabajador', 'Observaciones', 'ID'],
    [...records.activities]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((activity) => [
        activity.date, labelOf(activityTypeLabels, activity.activity_type), activity.description,
        activity.animal?.ica_code ?? '', activity.animal?.name ?? '',
        activity.worker?.full_name ?? '', activity.notes ?? '', activity.id,
      ]),
    [16, 22, 42, 16, 22, 26, 36, 38],
  );

  detailTable(
    workbook,
    'Enfermedades',
    'Reportes de enfermedades · historial completo',
    ['Fecha del reporte', 'Chapeta ICA', 'Animal', 'Síntomas', 'Diagnóstico', 'Tratamiento', 'Estado', 'Observaciones', 'Reportado por (ID)', 'ID'],
    [...records.diseases]
      .sort((a, b) => b.report_date.localeCompare(a.report_date))
      .map((report) => [
        report.report_date, report.animal?.ica_code ?? '', report.animal?.name ?? '',
        report.symptoms, report.diagnosis ?? '', report.treatment ?? '',
        labelOf(diseaseStatusLabels, report.status), report.notes ?? '',
        report.reported_by ?? '', report.id,
      ]),
    [18, 16, 22, 38, 36, 36, 18, 36, 38, 38],
  );

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `reporte_finca_${generatedAt.toISOString().slice(0, 10)}.xlsx`,
  );
}
