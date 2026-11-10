import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalAlign,
  VerticalPositionRelativeFrom,
  WidthType,
} from 'docx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'documentacion', 'Informe_calidad_FincaControl_FURPS_2.0.1_Manual_v3.docx');
const page = { width: 816, height: 1248 };
const headerHeight = page.width * (539 / 2362);
const footerHeight = page.width * (397 / 3964);
const leftWidth = page.height * (141 / 2170);
const rightWidth = page.height * (130 / 2170);
const coverWidth = page.width - leftWidth;
const bannerHeight = page.height - headerHeight - footerHeight;
const bannerWidth = coverWidth * (725 / 2170) * 0.66;
const coverTextWidth = coverWidth - bannerWidth;
const textWidth = Math.round((page.width - leftWidth - rightWidth) * 15);
const bodyHeaderGap = 10;
const toTwips = (px) => Math.round(px * 15);
const palette = {
  green: '123B31',
  greenLight: 'EAF1ED',
  gold: 'CBA84D',
  text: '23342D',
  muted: '68766E',
  border: 'D8E2DA',
  white: 'FFFFFF',
};

const imageDirectory = path.join(root, 'public', 'images');
const artwork = {
  header: await readFile(path.join(imageDirectory, 'encabezado_FincaControl_sin_bordes_blancos.png')),
  footer: await readFile(path.join(imageDirectory, 'Banner-pie de pagina FincaControl Verde y Dorado.png')),
  left: await readFile(path.join(imageDirectory, 'margen_lateral_izquierdo_FincaControl_solo_margen.png')),
  right: await readFile(path.join(imageDirectory, 'margen_derecho_FincaControl_sin_espacio_extra.png')),
  banner: await readFile(path.join(imageDirectory, 'Banner agrícola con toro Nelore y paisaje tropical.png')),
};
const screenshotDirectory = path.join(root, 'documentacion', 'capturas-calidad');
const screenshots = [
  { caption: 'Inicio y finca activa', file: '01-Inicio.png' },
  { caption: 'Registro de animales', file: '02-Animales.png' },
  { caption: 'Módulo de vacunas', file: '03-Vacunas.png' },
  { caption: 'Resumen y reportes', file: '04-Reportes.png' },
].map(async (screenshot) => ({
  ...screenshot,
  data: await readFile(path.join(screenshotDirectory, screenshot.file)),
}));
const screenshotEvidence = await Promise.all(screenshots);

const characteristics = [
  {
    code: 'F',
    name: 'Funcionalidad',
    maximum: 30,
    factors: [
      {
        name: 'Características y capacidades del programa',
        weight: 10,
        rating: 3,
        question: '¿Los módulos cubren las operaciones ganaderas y agrícolas previstas?',
        evidence: 'La sección 6 del manual enumera Inicio, animales, leche, vacunas, inventarios, cultivos, piscicultura, actividades, enfermedades y reportes. En la app se observaron Inicio, Animales, Vacunas y Reportes; el flujo de producción se validó solo con los 3 bovinos mostrados. Las demás funciones y las operaciones de alta/edición se dejaron pendientes, por lo que la cobertura es parcial.',
      },
      {
        name: 'Generalidad de las funciones',
        weight: 10,
        rating: 3,
        question: '¿Las funciones admiten perfiles, fincas y flujos configurables?',
        evidence: 'Las secciones 4–5 del manual exigen confirmar la finca activa y describen perfiles administrador y trabajador con permisos distintos. En la sesión se observó un administrador con la finca La Lucha; no se cambió de finca, no se autenticó un trabajador ni se comprobaron sus restricciones.',
      },
      {
        name: 'Seguridad del sistema',
        weight: 10,
        rating: 2,
        question: '¿La autenticación y el alcance de acceso están implementados?',
        evidence: 'El manual indica cuenta activa, cuenta propia y módulos limitados por perfil/finca (secciones 3–5 y 11). Se observó una sesión administrativa autenticada y una respuesta 401 en una consulta no autenticada; no se probaron inicio/cierre de sesión, permisos de trabajador, aislamiento de fincas ni amenazas. Nota limitada; no demuestra una vulnerabilidad.',
      },
    ],
  },
  {
    code: 'U',
    name: 'Facilidad de uso',
    maximum: 20,
    factors: [
      {
        name: 'Capacidad de prueba',
        weight: 5,
        rating: 3,
        question: '¿Las funciones visibles se pueden comprobar con resultados observables?',
        evidence: 'Siguiendo las secciones 7–8 del manual, se buscó la chapeta 100 antes de crear: apareció solo ese animal y al limpiar el filtro volvieron tres registros. Se abrió el formulario, pero no se verificó el rechazo de una chapeta duplicada ni se guardó una ficha.',
      },
      {
        name: 'Capacidad de configuración',
        weight: 5,
        rating: 3,
        question: '¿Se pueden adaptar opciones y módulos a cada finca?',
        evidence: 'El manual (secciones 4–5 y 6) condiciona fincas, módulos y administración al perfil. Se observó la finca activa y el acceso a su administración; no se modificaron permisos ni ajustes, ni se verificó su persistencia.',
      },
      {
        name: 'Compatibilidad',
        weight: 5,
        rating: 3,
        question: '¿La solución define con claridad los entornos de uso disponibles?',
        evidence: 'El software 2.0.1 se observó en ventanas de 390×844 y 1366×900; además, se inició el ejecutable portable y se abrió el asistente del instalador Windows. No se probó una matriz de otros sistemas operativos ni una instalación completada.',
      },
      {
        name: 'Requisitos de instalación',
        weight: 5,
        rating: 3,
        question: '¿Se ofrecen opciones de instalación documentadas?',
        evidence: 'El manual, sección 3, especifica Windows 10/11 de 64 bits, instalador o portable y cuenta activa. Se inició el portable y se abrió el asistente del instalador, que se cerró sin instalar; no se verificaron inicio de sesión desde instalación limpia, actualización ni desinstalación.',
      },
    ],
  },
  {
    code: 'R',
    name: 'Confiabilidad',
    maximum: 15,
    factors: [
      {
        name: 'Frecuencia y severidad de fallos',
        weight: 5,
        rating: 2,
        question: '¿El producto se mantuvo estable durante los flujos observados?',
        evidence: 'El software permitió recorrer Inicio, Animales, Vacunas y Reportes y el portable abrió. Al regresar a Inicio se observaron respuestas 401 en la consola técnica y la recuperación no se verificó paso a paso. Tampoco se ejercitaron el flujo offline, la cola pendiente, la sincronización o los conflictos descritos en el manual.',
      },
      {
        name: 'Exactitud de las salidas',
        weight: 5,
        rating: 3,
        question: '¿Los cálculos y reportes tienen reglas verificables?',
        evidence: 'El panel y el reporte mostraron tres animales y un bovino en cada categoría visible, en concordancia con el listado observado. No se compararon todas las métricas con una fuente contable independiente ni se verificaron datos de producción.',
      },
      {
        name: 'Capacidad de predicción',
        weight: 5,
        rating: 3,
        question: '¿El sistema comunica de forma comprensible los estados y conflictos?',
        evidence: 'El manual (sección 10) define estados conectado/sin conexión, cola y resolución de conflictos. Se observó el indicador En línea y una confirmación al solicitar el reporte, pero no se simuló desconexión ni se comprobó un conflicto; además, las respuestas 401 observadas no tuvieron explicación visible.',
      },
    ],
  },
  {
    code: 'P',
    name: 'Rendimiento',
    maximum: 20,
    factors: [
      {
        name: 'Factores humanos',
        weight: 5,
        rating: 3,
        question: '¿La interacción contempla necesidades de los usuarios previstos?',
        evidence: 'El flujo recomendado del manual (sección 7) y las buenas prácticas (sección 11) piden verificar finca, buscar antes de crear, revisar datos y confirmar el guardado. Se probó búsqueda y formulario sin guardar; a 390×844 no había desbordamiento de página, aunque se debe desplazar el diálogo para llegar a Guardar. Los botones de fila no anunciaban nombre accesible.',
      },
      {
        name: 'Factores estéticos',
        weight: 5,
        rating: 3,
        question: '¿La presentación visual mantiene una identidad reconocible?',
        evidence: 'Las secciones y acciones indicadas en el manual se contrastaron con el panel, Animales, Vacunas y Reportes activos; se observó una identidad visual consistente en ese recorrido. No se valoró con usuarios ni se revisaron todas las pantallas descritas.',
      },
      {
        name: 'Consistencia de la interfaz',
        weight: 5,
        rating: 3,
        question: '¿Se reutilizan patrones visuales y controles entre módulos?',
        evidence: 'Los nombres y accesos del menú de panel, Animales, Vacunas y Reportes coincidieron con las funciones descritas en el manual. No se recorrieron todos los módulos de la sección 6 ni variantes de menú por perfil.',
      },
      {
        name: 'Documentación',
        weight: 5,
        rating: 3,
        question: '¿Hay instrucciones utilizables para instalar y operar el producto?',
        evidence: 'Se usó el Manual_Usuario_FincaControl.docx de la distribución 2.0.1 como base de requisitos: propósito, requisitos, perfiles, catálogo de módulos, flujo recomendado, reglas de chapeta, diferencias vacuna/medicamento, operación offline y solución de problemas (secciones 1–13). Los pasos se contrastaron con pantallas observadas; no se ejecutó una prueba de uso completa siguiendo el manual ni con usuarios nuevos.',
      },
    ],
  },
  {
    code: 'S',
    name: 'Soporte',
    maximum: 15,
    factors: [
      {
        name: 'Velocidad de procesamiento',
        weight: 3,
        rating: 3,
        question: '¿Se midió el tiempo de procesamiento en cargas representativas?',
        evidence: 'El manual (sección 3) declara que no hay mínimos oficiales de CPU, memoria o almacenamiento. No se midieron benchmarks; la nota es neutral por falta de umbrales y datos, no una afirmación de velocidad satisfactoria.',
      },
      {
        name: 'Tiempo de respuesta',
        weight: 3,
        rating: 3,
        question: '¿Se midió la latencia de API e interfaz en escenarios reales?',
        evidence: 'El manual no publica límites de latencia. No se midieron percentiles ni concurrencia; los tiempos de carga observados en una sesión local no constituyen una prueba de rendimiento.',
      },
      {
        name: 'Consumo de recursos',
        weight: 3,
        rating: 3,
        question: '¿Se perfiló el uso de memoria, CPU, red y almacenamiento?',
        evidence: 'El manual (sección 3) no fija mínimos de recursos. No se perfiló CPU, memoria, red o almacenamiento; sin un escenario de carga y criterios del manual no es posible asignar una conclusión de capacidad.',
      },
      {
        name: 'Rendimiento efectivo total',
        weight: 3,
        rating: 3,
        question: '¿Se comprobó el rendimiento global contra objetivos definidos?',
        evidence: 'El manual describe uso en línea y offline y reconoce ausencia de mínimos de hardware, pero no establece objetivos de rendimiento. No se midió el rendimiento integral ni se probó el flujo offline para sostener una valoración empírica.',
      },
      {
        name: 'Eficacia',
        weight: 3,
        rating: 3,
        question: '¿Los flujos principales cumplen criterios de éxito medibles?',
        evidence: 'La guía define la secuencia de revisar finca, preparar datos, buscar duplicados, completar, guardar y confirmar (sección 7). Solo se recorrieron finca, búsqueda y apertura/cancelación del formulario; no se guardó información ni se midió éxito del proceso completo.',
      },
    ],
  },
];

const factors = characteristics.flatMap((characteristic) =>
  characteristic.factors.map((factor) => ({ ...factor, code: characteristic.code, category: characteristic.name })),
);
const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
const totalScore = factors.reduce((sum, factor) => sum + factor.weight * factor.rating / 4, 0);
if (factors.length !== 19 || totalWeight !== 100 || totalScore !== 71.25) {
  throw new Error(`Cálculo FURPS inesperado: ${factors.length} factores, peso ${totalWeight}, resultado ${totalScore}.`);
}

function floatingImage(data, width, height, x, y, zIndex, behindDocument = false) {
  return new ImageRun({
    type: 'png',
    data,
    transformation: { width, height },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: toTwips(x) * 635 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: toTwips(y) * 635 },
      allowOverlap: true,
      behindDocument,
      wrap: { type: TextWrappingType.NONE },
      zIndex,
    },
  });
}

function makeHeader(interior) {
  const drawings = [floatingImage(artwork.left, leftWidth, page.height, 0, 0, 1, true)];
  if (interior) drawings.push(floatingImage(artwork.right, rightWidth, page.height, page.width - rightWidth, 0, 1, true));
  drawings.push(floatingImage(artwork.header, page.width, headerHeight, 0, 0, 2));
  return new Header({ children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: drawings })] });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          floatingImage(
            artwork.footer,
            page.width,
            footerHeight,
            0,
            page.height - footerHeight,
            3,
          ),
        ],
      }),
    ],
  });
}

function pageMargins(interior) {
  return {
    size: { width: 12240, height: 18720 },
    margin: {
      top: toTwips(headerHeight + (interior ? bodyHeaderGap : 0)),
      bottom: toTwips(footerHeight),
      left: toTwips(leftWidth),
      right: interior ? toTwips(rightWidth) : 0,
      header: 0,
      footer: 0,
    },
  };
}

function heading(text, level = HeadingLevel.HEADING_1) {
  const primary = level === HeadingLevel.HEADING_1;
  return new Paragraph({
    heading: level,
    keepNext: true,
    keepLines: true,
    spacing: { before: primary ? 210 : 150, after: 90 },
    border: primary ? { bottom: { color: palette.gold, size: 8, style: BorderStyle.SINGLE, space: 4 } } : undefined,
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: primary ? 28 : 23,
        bold: true,
        color: primary ? palette.green : '064E3B',
      }),
    ],
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    keepLines: true,
    children: [new TextRun({ text, font: 'Arial', size: 19, color: palette.text })],
    ...options,
  });
}

function cell(text, width, { header = false, bold = false, fill, align } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 75, bottom: 75, left: 80, right: 80 },
    verticalAlign: VerticalAlign.TOP,
    shading: fill ? { fill } : header ? { fill: palette.green } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 0, after: 0 },
        keepLines: true,
        children: [
          new TextRun({
            text: String(text),
            font: 'Arial',
            size: header ? 16 : 16,
            bold: header || bold,
            color: header ? palette.white : palette.text,
          }),
        ],
      }),
    ],
  });
}

function table(headers, rows, widths, options = {}) {
  if (widths.reduce((sum, width) => sum + width, 0) !== textWidth) {
    throw new Error(`El ancho de tabla no coincide con el área imprimible: ${widths.reduce((sum, width) => sum + width, 0)} / ${textWidth}.`);
  }
  const makeRow = (values, rowIndex) =>
    new TableRow({
      tableHeader: rowIndex === -1,
      cantSplit: true,
      children: values.map((value, index) =>
        cell(value, widths[index], {
          header: rowIndex === -1,
          bold: Boolean(options.boldRows?.includes(rowIndex)),
          fill: rowIndex >= 0 && rowIndex % 2 === 1 ? 'F5F8F6' : undefined,
          align: options.centerColumns?.includes(index) ? AlignmentType.CENTER : undefined,
        }),
      ),
    });
  return new Table({
    width: { size: textWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      makeRow(headers, -1),
      ...rows.map((row, index) => makeRow(row, index)),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: palette.border },
    },
  });
}

function cover() {
  const noBorders = Object.fromEntries(
    ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map((side) => [
      side,
      { style: BorderStyle.NIL, size: 0, color: palette.white },
    ]),
  );
  const details = [
    ['SOFTWARE', 'FincaControl'],
    ['VERSIÓN', '2.0.1'],
    ['MODELO', 'FURPS, según las tablas del ejemplo facilitado'],
    ['ALCANCE', 'Prueba funcional del producto en vivo y de artefactos Windows'],
    ['FECHA', '8 de noviembre de 2026'],
  ];
  const text = [
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: 'DOCUMENTO OFICIAL DE LA FINCA',
          font: 'Arial',
          size: 19,
          bold: true,
          color: palette.gold,
          characterSpacing: 20,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 90 },
      children: [
        new TextRun({
          text: 'INFORME DE EVALUACIÓN DE CALIDAD DEL SOFTWARE',
          font: 'Arial',
          size: 34,
          bold: true,
          color: palette.green,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 250 },
      children: [
        new TextRun({
          text: 'Modelo FURPS aplicado a FincaControl',
          font: 'Times New Roman',
          size: 23,
          color: palette.muted,
        }),
      ],
    }),
    ...details.map(
      ([label, value]) =>
        new Paragraph({
          spacing: { after: 130 },
          children: [
            new TextRun({ text: `${label}  `, font: 'Arial', size: 17, bold: true, color: '064E3B' }),
            new TextRun({ text: value, font: 'Times New Roman', size: 19, color: palette.text }),
          ],
        }),
    ),
    new Paragraph({
      spacing: { before: 180 },
      children: [
        new TextRun({
          text: 'Preparado por  Oscar David Vega Daza',
          font: 'Times New Roman',
          size: 18,
          bold: true,
          color: '064E3B',
        }),
      ],
    }),
  ];
  return new Table({
    width: { size: toTwips(coverWidth), type: WidthType.DXA },
    columnWidths: [toTwips(coverTextWidth), toTwips(bannerWidth)],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: toTwips(coverTextWidth), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 0, left: 240, right: 180 },
            children: text,
          }),
          new TableCell({
            width: { size: toTwips(bannerWidth), type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            shading: { fill: palette.green },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: 'png',
                    data: artwork.banner,
                    transformation: { width: bannerWidth, height: bannerHeight },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    borders: noBorders,
  });
}

const weightRows = [];
const weightSubtotalIndices = [];
for (const characteristic of characteristics) {
  for (const factor of characteristic.factors) {
    weightRows.push([
      `${characteristic.code} · ${characteristic.name}`,
      factor.name,
      String(factor.weight),
      `Valoración 1–4; aporte máximo ${factor.weight} puntos`,
    ]);
  }
  weightRows.push([
    `${characteristic.code} · ${characteristic.name}`,
    'Subtotal de característica',
    String(characteristic.maximum),
    'Peso máximo del atributo',
  ]);
  weightSubtotalIndices.push(weightRows.length - 1);
}
weightRows.push(['', 'Puntaje total del modelo', '100', 'Peso total disponible']);
weightSubtotalIndices.push(weightRows.length - 1);

const scaleRows = [
  ['4', 'Excelente', 'Implementación sólida con evidencia directa y verificable para el factor.'],
  ['3', 'Bueno', 'Capacidad implementada; quedan límites de verificación o cobertura.'],
  ['2', 'Regular', 'Implementación parcial, evidencia limitada o brechas importantes.'],
  ['1', 'Malo', 'No se encontró capacidad suficiente o existe una deficiencia demostrada.'],
];

const manualCoverageRows = [
  [
    'Sección 3 — Requisitos y preparación offline: Windows 10/11 x64, cuenta activa, primer acceso conectado, copia local previa al modo offline y reanudación online.',
    'Portable abierto y asistente del instalador abierto. No se completó instalación, autenticación desde cero, creación de copia offline, desconexión ni sincronización.',
    'Parcial',
  ],
  [
    'Sección 4 — Inicio: autenticarse, confirmar finca activa y navegar por módulos permitidos.',
    'La sesión ya estaba autenticada como administrador; se observó la finca La Lucha y la navegación. No se repitió login ni se cambió de finca.',
    'Parcial',
  ],
  [
    'Sección 5 — Perfiles: comprobar diferencias entre administrador y trabajador, módulos y pantalla de carga de datos.',
    'Se observó únicamente el perfil administrador. No se inició sesión como trabajador ni se validó pantalla Carga de datos.',
    'Pendiente',
  ],
  [
    'Sección 6 — Módulos: recorrido de los módulos visibles y su uso principal, incluidos leche, medicamentos, insumos, equipos, cultivos, piscicultura, actividades y enfermedades.',
    'Se abrieron Inicio, Animales, Vacunas y Reportes. Los demás módulos no se ejercitaron.',
    'Parcial',
  ],
  [
    'Sección 6 — Reportes: generar Excel y Word, abrirlos y comprobar secciones y datos completos de la finca activa.',
    'En Reportes se solicitó Descargar reporte y la app mostró confirmación; no se verificó el archivo descargado. Descargar Excel y el contenido de ambos formatos quedaron pendientes.',
    'Parcial',
  ],
  [
    'Sección 7 — Flujo recomendado: comprobar finca, preparar datos, buscar duplicados, completar formulario, guardar y confirmar; revisar pendientes.',
    'Se comprobó finca activa y búsqueda previa a crear chapeta 100. Se abrió y canceló un formulario; no se guardó ni se observó una confirmación de persistencia.',
    'Parcial',
  ],
  [
    'Sección 8 — Animales: buscar ficha, chapeta ICA única, evitar duplicados, revisar categorías, estado reproductivo y animal elegible para producción.',
    'La búsqueda filtró la chapeta 100 correctamente; no se intentó guardar un duplicado ni se validaron elegibilidad productiva, edición o conservación de la ficha.',
    'Parcial',
  ],
  [
    'Sección 9 — Vacunas/medicamentos: distinguir el nombre de vacuna del medicamento de inventario y verificar la relación.',
    'La pantalla Vacunas mostró estado vacío. No se creó una vacuna ni se comprobó selección, relación o existencias de medicamentos.',
    'Pendiente',
  ],
  [
    'Sección 10 — Conexión: crear copia offline, encolar cambios locales, sincronizar y resolver conflictos/rechazos según el flujo descrito.',
    'No se alteró la conexión ni se generaron cambios pendientes. El flujo offline, persistencia local y resolución de conflictos requieren una prueba controlada posterior.',
    'Pendiente',
  ],
  [
    'Sección 11 — Buenas prácticas: verificar finca/animal, usar datos reales y revisar conexión y cola antes de salir.',
    'Se conservó la finca activa y se evitó modificar datos durante la evaluación. No se comprobó el ciclo de registro y confirmación de extremo a extremo.',
    'Parcial',
  ],
  [
    'Sección 12 — Solución de problemas: validar respuestas para login, permisos, chapeta duplicada, sincronización y conflictos.',
    'No se indujeron fallos de negocio. Se observaron respuestas 401 al volver a Inicio, seguidas de una vista con datos; el motivo y el flujo de recuperación no se identificaron.',
    'Pendiente',
  ],
  [
    'Sección 13 — Ayuda e información: comprobar titularidad, licencia y canal de soporte descrito.',
    'No se abrió Ayuda e Información durante esta evaluación funcional.',
    'Pendiente',
  ],
];

const evaluationRows = factors.map((factor) => [
  `${factor.code} · ${factor.category}`,
  factor.name,
  factor.question,
  String(factor.rating),
  factor.evidence,
]);

const weightedRows = [];
const weightedSubtotalIndices = [];
for (const characteristic of characteristics) {
  const characteristicFactors = factors.filter((factor) => factor.code === characteristic.code);
  for (const factor of characteristicFactors) {
    weightedRows.push([
      `${factor.code} · ${factor.category}`,
      factor.name,
      String(factor.weight),
      String(factor.rating),
      (factor.weight * factor.rating / 4).toFixed(2).replace('.', ','),
    ]);
  }
  const obtained = characteristicFactors.reduce((sum, factor) => sum + factor.weight * factor.rating / 4, 0);
  weightedRows.push([
    '',
    `Subtotal ${characteristic.code} · ${characteristic.name}`,
    String(characteristic.maximum),
    '',
    obtained.toFixed(2).replace('.', ','),
  ]);
  weightedSubtotalIndices.push(weightedRows.length - 1);
}
weightedRows.push(['', 'TOTAL FURPS', '100', '', totalScore.toFixed(2).replace('.', ',')]);
weightedSubtotalIndices.push(weightedRows.length - 1);

const categoryRows = characteristics.map((characteristic) => {
  const obtained = factors
    .filter((factor) => factor.code === characteristic.code)
    .reduce((sum, factor) => sum + factor.weight * factor.rating / 4, 0);
  return [
    `${characteristic.code} · ${characteristic.name}`,
    String(characteristic.maximum),
    obtained.toFixed(2).replace('.', ','),
    `${(obtained / characteristic.maximum * 100).toFixed(2).replace('.', ',')} %`,
  ];
});
categoryRows.push([
  'TOTAL',
  '100',
  totalScore.toFixed(2).replace('.', ','),
  `${(totalScore / totalWeight * 100).toFixed(2).replace('.', ',')} %`,
]);

const findingsRows = [
  [
    'Alta',
    'Ejecutar los flujos prioritarios del manual con una cuenta de prueba: altas y edición, rechazo de chapeta duplicada, guardado confirmado y roles administrador/trabajador.',
    'Cada procedimiento de las secciones 5, 7 y 8 queda probado con datos de prueba y resultado de persistencia comprobado.',
  ],
  [
    'Alta',
    'Validar el procedimiento offline completo en un entorno controlado, incluidos copia local previa, cola, reconexión y resolución de conflicto.',
    'Las operaciones soportadas sobreviven a cierre/reinicio, se sincronizan y el usuario puede resolver conflictos sin pérdida silenciosa.',
  ],
  [
    'Alta',
    'Asignar nombres accesibles a los botones de editar y eliminar en las filas de animales y comprobarlo con lector de pantalla.',
    'Cada control anuncia su propósito, registro y acción sin depender del icono visual.',
  ],
  [
    'Alta',
    'Mejorar el formulario móvil para que el área de acciones Guardar/Cancelar quede visible o claramente alcanzable sin desplazamiento extenso.',
    'A 390×844, campos y acciones se completan sin que el pie del diálogo quede inesperadamente fuera de vista.',
  ],
  [
    'Alta',
    'Realizar una instalación limpia, actualización desde una versión anterior y desinstalación controlada del instalador 2.0.1.',
    'Los tres flujos se completan en Windows de prueba y conservan o eliminan datos según lo informado al usuario.',
  ],
  [
    'Media',
    'Validar los reportes Word y Excel descargados con documentos reales generados desde la sesión operativa.',
    'Los archivos se abren, incluyen los datos esperados y corresponden a filtros y finca seleccionados.',
  ],
  [
    'Media',
    'Medir carga y respuesta de la aplicación con cantidad y volumen de datos representativos.',
    'Definir límites de latencia, memoria y concurrencia y registrar mediciones repetibles.',
  ],
  [
    'Antes de ampliar producción',
    'Validar permisos por rol/finca y realizar una revisión independiente de seguridad y aceptación con usuarios.',
    'Documentar escenarios, resultados y remediaciones; este informe no es pentest ni certificación.',
  ],
];

const contents = [
  heading('1. Resumen ejecutivo'),
  paragraph(
    'La base de evaluación fue el Manual_Usuario_FincaControl.docx 2.0.1 distribuido con el software: sus requisitos, perfiles, módulos, flujo recomendado, reglas de animales, vacunas/medicamentos, sincronización y solución de problemas se trataron como criterios de aceptación. Se contrastaron con el producto en ejecución y con el instalador/portable. El resultado ponderado FURPS es 71,25/100 (2,85/4); la mayoría de los procesos definidos en el manual quedaron identificados, pero no se probaron de extremo a extremo. La referencia FURPS no fija un umbral general de aprobación.',
  ),
  table(
    ['Resultado', 'Puntaje', 'Lectura', 'Confianza de la evidencia'],
    [['FURPS', '71,25 / 100', 'Promedio 2,85 / 4; sin umbral global en la referencia', 'Media en pantallas y flujos parciales; baja en los procesos offline, roles y módulos no recorridos']],
    [1700, 1800, 2500, textWidth - 6000],
  ),
  paragraph(
    'La evaluación es de caja negra y alcance limitado: se valoró el comportamiento observable del software distribuido, sin usar la descripción técnica interna como sustituto de las pruebas. La puntuación no es una certificación ni garantiza ausencia de defectos.',
  ),

  heading('2. Objetivo, alcance y método'),
  paragraph(
    'Objetivo: evaluar el producto funcional usando como base primaria el manual de usuario de la misma versión y como instrumento las ponderaciones, factores, escala y conversión FURPS de “Plantilla modelo ejemplo.docx”. El manual define qué ofrece el sistema y los procedimientos que se deben contrastar; la observación en vivo determina cuáles de esos criterios se pudieron comprobar.',
  ),
  paragraph(
    'Fuente principal: Manual_Usuario_FincaControl.docx incluido en build_windows/Version_2.0.1, versión 2.0.1, actualizado el 7 de noviembre de 2026. Se usaron especialmente sus secciones 3–12: requisitos, interfaz, perfiles, módulos, informes, flujo recomendado, reglas de animales, vacunas y medicamentos, modo offline, buenas prácticas y solución de problemas.',
  ),
  paragraph(
    'Software evaluado: FincaControl 2.0.1 y su distribución para Windows. Se inició el ejecutable portable y se abrió el asistente del instalador. En el software se contrastaron las pantallas Inicio, Animales, Vacunas y Reportes con los procedimientos del manual; se buscó la chapeta 100, se abrió y canceló un formulario sin guardar, se solicitó un reporte Word y se comprobó la presentación en ventanas de 390×844 y 1366×900.',
  ),
  paragraph(
    'No se escribieron datos de negocio ni se completó la instalación. Tampoco se realizaron login limpio, escenarios de trabajador, altas/ediciones guardadas, validación de chapeta duplicada, exportación y lectura de archivos, desconexión y sincronización, flujos de conflicto, cobertura de todos los módulos, pruebas de carga, pentest o estudio formal con usuarios.',
  ),
  paragraph(
    'Se conserva la agrupación y ponderación exactas de las tablas FURPS del ejemplo aportado, incluso donde sus nombres de factores difieren de otras variantes del modelo. Aporte por factor = peso × valoración / 4. Los pesos suman 100; la referencia no inventa un umbral de aprobación global.',
  ),
  heading('2.1 Manual de usuario como base de evaluación', HeadingLevel.HEADING_2),
  paragraph(
    'La matriz siguiente convierte instrucciones del manual en criterios verificables. “Parcial” significa que solo se comprobó una parte del procedimiento; “Pendiente” significa que el procedimiento no se ejecutó. No se acreditan como probadas las funciones solo porque el manual las describa.',
  ),
  table(
    ['Criterio derivado del manual', 'Contraste con el producto en vivo', 'Cobertura'],
    manualCoverageRows,
    [3400, textWidth - 5300, 1900],
  ),

  heading('3. Escala de valoración'),
  table(['Valor', 'Nivel', 'Criterio aplicado en este informe'], scaleRows, [900, 2000, textWidth - 2900]),
  paragraph(
    'Las notas reflejan cobertura del criterio definido por el manual, no la mera existencia de una pantalla. Una nota 2 en confiabilidad o seguridad indica funcionamiento o evidencia parcial frente al procedimiento esperado; no afirma que se haya demostrado una vulnerabilidad. Para rendimiento, el manual dice expresamente que no hay mínimos oficiales de CPU, memoria o almacenamiento; las notas neutrales no certifican rapidez.',
  ),

  heading('4. Tabla de ponderación FURPS'),
  paragraph(
    'La siguiente tabla mantiene los 19 factores y los pesos del ejemplo. Cada atributo suma el máximo de su característica; los pesos totalizan 100 puntos.',
  ),
  table(
    ['Característica', 'Factor', 'Peso', 'Regla de conversión'],
    weightRows,
    [1900, 3000, 800, textWidth - 5700],
    { boldRows: weightSubtotalIndices },
  ),

  heading('5. Formulario de evaluación aplicado'),
  paragraph(
    'La valoración se asigna a cada factor en una escala de 1 a 4. La columna de evidencia identifica la interacción probada del producto y las limitaciones de ese ensayo.',
  ),
  table(
    ['Característica', 'Factor', 'Qué se valora', 'Nota', 'Evidencia y límite'],
    evaluationRows,
    [1600, 1800, 2100, 650, textWidth - 6150],
    { centerColumns: [3] },
  ),

  heading('6. Conversión de valoraciones a puntajes'),
  paragraph(
    'Para hacer reproducible el resultado, cada aporte se calcula como peso × nota / 4. Los subtotales se presentan por característica; la nota 4 produce el puntaje máximo asignado a ese factor.',
  ),
  table(
    ['Característica', 'Factor', 'Peso', 'Nota', 'Puntos obtenidos'],
    weightedRows,
    [1800, 4100, 900, 800, textWidth - 7600],
    { centerColumns: [2, 3, 4], boldRows: weightedSubtotalIndices },
  ),

  heading('7. Resultado por característica'),
  table(
    ['Característica', 'Máximo', 'Obtenido', 'Cumplimiento del peso'],
    categoryRows,
    [3600, 1500, 1900, textWidth - 7000],
    { centerColumns: [1, 2, 3] },
  ),
  paragraph(
    'Resultado ponderado: 71,25/100 = 2,85/4. La escala de referencia no ofrece una tabla que asigne una categoría, aprobado/reprobado o umbrales al total. Los porcentajes por característica expresan puntos obtenidos respecto al peso, no porcentaje de requisitos aprobados.',
  ),

  heading('8. Pruebas del producto en funcionamiento'),
  table(
    ['Escenario probado', 'Resultado', 'Observación y límite'],
    [
      ['Panel y conexión', 'Correcto', 'El panel mostró estado En línea y datos del entorno conectado: 3 bovinos, con una novilla, un toro y una vaca.'],
      ['Búsqueda de animales', 'Correcto', 'Buscar chapeta 100 devolvió solo ese registro; al limpiar la búsqueda se restauraron las 3 filas. No se editaron ni borraron registros.'],
      ['Vacunas', 'Correcto con estado vacío', 'La pantalla, filtros y estado “No hay vacunas programadas” se mostraron sin error; no se creó ni modificó información.'],
      ['Formulario de animal', 'Abre y valida campos requeridos', 'El formulario mostró 10 controles y Guardar deshabilitado al abrirlo. Se canceló sin guardar. Las acciones del pie se alcanzan desplazando el contenido interno del diálogo.'],
      ['Reporte Word', 'El software mostró confirmación de generación', 'No se verificó el archivo resultante ni se contrastó su contenido con los registros, como indica el manual.'],
      ['Diseño adaptable', 'Sin desbordamiento de página', 'A 390×844 y 1366×900 el ancho del documento coincidió con el viewport. La tabla usa desplazamiento horizontal interno; en móvil el pie del formulario no está visible hasta desplazar el diálogo.'],
      ['Recarga de Inicio', 'Datos visibles después de respuestas 401', 'Al regresar a Inicio la consola técnica mostró respuestas 401; después se mostró el panel con datos y estado En línea. No se confirmó el motivo ni el mecanismo de recuperación.'],
      ['Portable FincaControl 2.0.1', 'Ventana iniciada', 'El ejecutable abrió una ventana titulada FINCA CONTROL - Sistema de Gestión Agrícola y Ganadera; el proceso se cerró al terminar la comprobación.'],
      ['Instalador FincaControl Setup 2.0.1', 'Asistente abierto y responde', 'Se abrió la ventana “Instalación de FincaControl” y se cerró sin avanzar ni instalar. No se verificaron actualización ni desinstalación.'],
    ],
    [2300, 2100, textWidth - 4400],
  ),
  paragraph(
    'La sesión ya estaba autenticada antes de iniciar las pruebas. No se ingresaron credenciales, no se intentó cambiar privilegios y no se simularon desconexiones para no afectar la instancia compartida.',
  ),
  heading('Capturas del software FincaControl 2.0.1', HeadingLevel.HEADING_2),
  ...screenshotEvidence.flatMap((screenshot, index) => [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      keepLines: true,
      spacing: { before: 40, after: 25 },
      children: [
        new ImageRun({
          type: 'png',
          data: screenshot.data,
          transformation: { width: 600, height: 395 },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `Figura ${index + 1}. ${screenshot.caption}.`,
          font: 'Arial',
          size: 16,
          color: palette.muted,
        }),
      ],
    }),
  ]),

  heading('9. Verificación del instalador y ejecutable'),
  table(
    ['Artefacto 2.0.1', 'Metadatos observados', 'Prueba y límite'],
    [
      ['FincaControl Setup 2.0.1.exe', 'Producto FincaControl; versión 2.0.1; 125.434.624 bytes; firma Authenticode: no firmado.', 'El asistente abrió su ventana y respondió; se cerró antes de instalar. No se probó una instalación limpia, actualización ni desinstalación.'],
      ['FincaControl 2.0.1.exe (portable)', 'Producto FincaControl; versión 2.0.1; 107.006.120 bytes; firma Authenticode: no firmado.', 'Se inició el portable y se observó su ventana. No se probó una instalación ni se evaluó persistencia offline del cliente empaquetado.'],
    ],
    [2600, 3500, textWidth - 6100],
  ),
  paragraph(
    'La condición “no firmado” significa que Windows no dispone de un certificado Authenticode del publicador para verificar criptográficamente la procedencia del ejecutable; por sí sola no determina que el archivo sea malicioso. Se comprobó que el asistente abre, pero no se completó la instalación porque eso modificaría el equipo.',
  ),

  heading('10. Fortalezas y oportunidades observadas'),
  paragraph('• El panel y los módulos revisados cargaron datos reales del entorno conectado y mantuvieron el contexto de la finca activa.'),
  paragraph('• La búsqueda filtró la lista de animales y el borrado del filtro restauró los resultados esperados.'),
  paragraph('• La app ofreció estado vacío legible, filtros visibles y una confirmación visual tras solicitar el reporte.'),
  paragraph('• La página no presentó desbordamiento horizontal en las dos dimensiones probadas; el formulario móvil permite acceder a sus acciones mediante desplazamiento interno.'),
  paragraph('• El portable 2.0.1 abrió la ventana principal y el instalador/portable reportan la versión esperada.'),
  paragraph('• Oportunidades: controles de fila sin nombre accesible, acciones del formulario fuera de la vista inicial en móvil, firma Authenticode ausente y flujos de instalación/actualización aún no probados.'),

  heading('11. Plan de mejora priorizado'),
  table(
    ['Prioridad', 'Acción recomendada', 'Criterio de cierre sugerido'],
    findingsRows,
    [1700, 4000, textWidth - 5700],
  ),

  heading('12. Conclusión'),
  paragraph(
    'Aplicando como base el Manual_Usuario_FincaControl.docx 2.0.1, la prueba funcional acotada de FincaControl alcanza 71,25/100 (promedio 2,85/4). Se observaron parte de los recorridos de finca, navegación y búsqueda; otros procedimientos relevantes que el manual promete —perfiles trabajador, duplicados, guardado, reportes verificables y operación offline— quedaron pendientes. La valoración reducida de confiabilidad refleja que el flujo conectado/offline y su recuperación no se verificaron de extremo a extremo.',
  ),
  paragraph(
    'La puntuación no significa que se hayan ejecutado todas las instrucciones del manual. Las notas sobre permisos, rendimiento, exactitud integral y operación offline tienen baja confianza porque faltan pruebas de esos criterios. Recomendación: usar la tabla de cobertura como lista de aceptación, completar los procedimientos pendientes en un entorno de prueba y reevaluar con evidencia repetible. Este resultado no es certificación ni declaración de conformidad con un estándar.',
  ),

  heading('13. Evidencias y referencias'),
  paragraph('• “Plantilla modelo ejemplo.docx” — fuente de las ponderaciones, los 19 factores y la escala FURPS.'),
  paragraph('• “Manual_Usuario_FincaControl.docx” 2.0.1, distribución Version_2.0.1 — base funcional de requisitos y procedimientos de evaluación (secciones 3–12).'),
  paragraph('• Interacción funcional con el software FincaControl 2.0.1 y comprobación de inicio del ejecutable portable y del asistente del instalador Windows, durante la evaluación del 8 de noviembre de 2026.'),
  paragraph('• Ejecutables FincaControl Setup 2.0.1.exe y FincaControl 2.0.1.exe (portable), en la carpeta de distribución Version_2.0.1.'),
  paragraph('• Manual de usuario de FincaControl 2.0.1 incluido junto a los paquetes de distribución.'),
];

await writeFile(
  output,
  await Packer.toBuffer(
    new Document({
      creator: 'Oscar David Vega Daza',
      title: 'Informe de evaluación de calidad de FincaControl 2.0.1 — FURPS',
      subject: 'Evaluación documental de calidad de software',
      description: 'Aplicación documentada del modelo FURPS según la plantilla de referencia proporcionada.',
      features: { updateFields: true },
      sections: [
        {
          properties: { page: pageMargins(false) },
          headers: { default: makeHeader(false) },
          footers: { default: makeFooter() },
          children: [cover()],
        },
        {
          properties: { page: pageMargins(true) },
          headers: { default: makeHeader(true) },
          footers: { default: makeFooter() },
          children: contents,
        },
      ],
    }),
  ),
);
process.stdout.write(`Informe FURPS generado: ${path.relative(root, output)} (${totalScore.toFixed(2)}/100)\n`);
