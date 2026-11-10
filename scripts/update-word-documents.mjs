import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
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
const images = path.join(root, 'public', 'images');
const page = { width: 816, height: 1248 };
const headerHeight = page.width * (539 / 2362);
const footerHeight = page.width * (397 / 3964);
const leftWidth = page.height * (141 / 2170);
const rightWidth = page.height * (130 / 2170);
const coverWidth = page.width - leftWidth;
const bannerHeight = page.height - headerHeight - footerHeight;
const bannerWidth = coverWidth * (725 / 2170) * 0.66;
const coverTextWidth = coverWidth - bannerWidth;
const bodyHeaderGap = 10;
const toTwips = (px) => Math.round(px * 15);
const artwork = {
  header: await readFile(path.join(images, 'encabezado_FincaControl_sin_bordes_blancos.png')),
  footer: await readFile(path.join(images, 'Banner-pie de pagina FincaControl Verde y Dorado.png')),
  left: await readFile(path.join(images, 'margen_lateral_izquierdo_FincaControl_solo_margen.png')),
  right: await readFile(path.join(images, 'margen_derecho_FincaControl_sin_espacio_extra.png')),
  banner: await readFile(path.join(images, 'Banner agrícola con toro Nelore y paisaje tropical.png')),
};

function floatImage(data, width, height, x, y, zIndex, behindDocument = false) {
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
  const drawings = [floatImage(artwork.left, leftWidth, page.height, 0, 0, 1, true)];
  if (interior) {
    drawings.push(floatImage(artwork.right, rightWidth, page.height, page.width - rightWidth, 0, 1, true));
  }
  drawings.push(floatImage(artwork.header, page.width, headerHeight, 0, 0, 2));
  return new Header({ children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: drawings })] });
}

function makeFooter() {
  return new Footer({ children: [new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [floatImage(
      artwork.footer,
      page.width,
      footerHeight,
      0,
      page.height - footerHeight,
      3,
    )],
  })] });
}

function makePageMargins(interior) {
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

function richText(markdown, options = {}) {
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let position = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > position) runs.push(new TextRun({ text: markdown.slice(position, index), ...options }));
    const value = match[0];
    if (value.startsWith('**')) {
      runs.push(new TextRun({ text: value.slice(2, -2), bold: true, ...options }));
    } else if (value.startsWith('`')) {
      runs.push(new TextRun({ text: value.slice(1, -1), font: 'Consolas', ...options }));
    } else {
      runs.push(new TextRun({ text: value.slice(1, value.indexOf(']')), ...options }));
    }
    position = index + value.length;
  }
  if (position < markdown.length) runs.push(new TextRun({ text: markdown.slice(position), ...options }));
  return runs.length ? runs : [new TextRun({ text: '', ...options })];
}

function bodyParagraph(markdown, options = {}) {
  return new Paragraph({
    spacing: { after: 90 },
    keepLines: true,
    children: richText(markdown, { font: 'Aptos', size: 20, color: '23342D' }),
    ...options,
  });
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function markdownTable(lines) {
  const rows = lines.filter((line) => !/^\|?[\s:|-]+\|?$/.test(line)).map(parseTableRow);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) => new TableRow({
      tableHeader: rowIndex === 0,
      cantSplit: true,
      children: row.map((cell) => new TableCell({
        shading: rowIndex === 0 ? { fill: '123B31' } : undefined,
        margins: { top: 90, bottom: 90, left: 100, right: 100 },
        children: [new Paragraph({
          children: richText(cell, {
            font: 'Aptos',
            size: 18,
            color: rowIndex === 0 ? 'FFFFFF' : '23342D',
          }),
        })],
      })),
    })),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D8E2DA' },
    },
  });
}

async function manualBody(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('## 1. Propósito'));
  if (start < 0) throw new Error('No se encontró el inicio del contenido del manual.');
  const children = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line.startsWith('|')) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      children.push(markdownTable(tableLines));
      continue;
    }
    const image = line.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (image) {
      const imagePath = path.resolve(root, 'guia', decodeURIComponent(image[1]));
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 120 },
        children: [new ImageRun({
          type: 'png',
          data: await readFile(imagePath),
          transformation: { width: 95, height: 95 },
        })],
      }));
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
      const title = heading[2].replace(/\*\*/g, '');
      children.push(new Paragraph({
        heading: level,
        keepNext: true,
        keepLines: true,
        spacing: { before: 180, after: 80 },
        border: level === HeadingLevel.HEADING_1
          ? { bottom: { color: 'CBA84D', size: 8, style: BorderStyle.SINGLE, space: 4 } }
          : undefined,
        children: richText(title, {
          font: 'Aptos Display',
          size: level === HeadingLevel.HEADING_1 ? 28 : 23,
          bold: true,
          color: level === HeadingLevel.HEADING_1 ? '123B31' : '064E3B',
        }),
      }));
      continue;
    }
    if (line.startsWith('>')) {
      children.push(bodyParagraph(line.replace(/^>\s*/, '').replace(/\*\*/g, ''), {
        indent: { left: 220, right: 120 },
        border: { left: { color: 'CBA84D', size: 18, style: BorderStyle.SINGLE, space: 8 } },
      }));
      continue;
    }
    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        keepLines: true,
        spacing: { after: 50 },
        children: richText(bullet[1], { font: 'Aptos', size: 20, color: '23342D' }),
      }));
      continue;
    }
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      children.push(bodyParagraph(`${numbered[1]}. ${numbered[2]}`, { indent: { left: 220, hanging: 220 } }));
      continue;
    }
    children.push(bodyParagraph(line));
  }
  return children;
}

function coverTable({ title, subtitle, details }) {
  const borderless = Object.fromEntries(
    ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical']
      .map((side) => [side, { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }]),
  );
  const text = [
    new Paragraph({
      children: [new TextRun({ text: 'DOCUMENTO OFICIAL DE LA FINCA', font: 'Arial', size: 19, bold: true, color: 'CBA84D', characterSpacing: 20 })],
      spacing: { after: 150 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, font: 'Arial', size: 40, bold: true, color: '123B31' })],
      spacing: { after: 90 },
    }),
    new Paragraph({
      children: [new TextRun({ text: subtitle, font: 'Times New Roman', size: 22, color: '68766E' })],
      spacing: { after: 250 },
    }),
    ...details.map(({ label, value }) => new Paragraph({
      spacing: { after: 130 },
      children: [
        new TextRun({ text: `${label}  `, font: 'Arial', size: 17, bold: true, color: '064E3B' }),
        new TextRun({ text: value, font: 'Times New Roman', size: 19, color: '23342D' }),
      ],
    })),
    new Paragraph({
      spacing: { before: 180 },
      children: [new TextRun({ text: 'Creado por  Oscar David Vega Daza', font: 'Times New Roman', size: 18, bold: true, color: '064E3B' })],
    }),
  ];
  return new Table({
    width: { size: toTwips(coverWidth), type: WidthType.DXA },
    columnWidths: [toTwips(coverTextWidth), toTwips(bannerWidth)],
    rows: [new TableRow({
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
          shading: { fill: '123B31' },
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
    borders: borderless,
  });
}

function makeDocument(title, coverSubtitle, details, content, creator = 'Oscar David Vega Daza') {
  const footer = makeFooter();
  return new Document({
    creator,
    title,
    features: { updateFields: true },
    sections: [
      {
        properties: { page: makePageMargins(false) },
        headers: { default: makeHeader(false) },
        footers: { default: footer },
        children: [coverTable({ title, subtitle: coverSubtitle, details })],
      },
      {
        properties: { page: makePageMargins(true) },
        headers: { default: makeHeader(true) },
        footers: { default: footer },
        children: content,
      },
    ],
  });
}

async function writeDotx(document, target) {
  const docxBuffer = await Packer.toBuffer(document);
  const zip = await JSZip.loadAsync(docxBuffer);
  const contentTypes = await zip.file('[Content_Types].xml').async('string');
  const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
  const templateType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml';
  if (!contentTypes.includes(docxType)) throw new Error('No se pudo identificar el tipo de documento Word generado.');
  zip.file('[Content_Types].xml', contentTypes.replace(docxType, templateType));
  await writeFile(target, await zip.generateAsync({ type: 'nodebuffer' }));
}

const manualSource = await readFile(path.join(root, 'guia', 'manual-usuario.md'), 'utf8');
const version = manualSource.match(/^\*\*Versión:\*\*\s*(.+)$/m)?.[1];
const updated = manualSource.match(/^\*\*Actualizado:\*\*\s*(.+)$/m)?.[1];
if (!version || !updated) throw new Error('No se pudieron leer la versión y la fecha del manual fuente.');
const template = makeDocument('Plantilla de documento', 'Formato editable para reportes de gestión', [
  { label: 'PREPARADO PARA', value: '[Nombre de la finca o destinatario]' },
  { label: 'RESPONSABLE', value: '[Nombre del responsable]' },
  { label: 'FECHA  |  VERSIÓN', value: '[DD / MM / AAAA]  |  [Versión]' },
], [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 100 },
    children: [new TextRun({ text: 'Resumen del documento', font: 'Aptos Display', size: 30, bold: true, color: '123B31' })],
  }),
  bodyParagraph('[Presente aquí el propósito, alcance y conclusiones principales del documento.]'),
  bodyParagraph('PUNTO CLAVE  [Escriba un hallazgo, alerta o dato importante para destacar.]'),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text: 'Datos y seguimiento', font: 'Aptos Display', size: 30, bold: true, color: '123B31' })],
  }),
  markdownTable(['| INDICADOR | VALOR | OBSERVACIÓN |', '|---|---|---|', '| Indicador | Valor | Observación |', '| Indicador | Valor | Observación |']),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text: 'Notas y responsables', font: 'Aptos Display', size: 30, bold: true, color: '123B31' })],
  }),
  bodyParagraph('[Agregue acciones pendientes, recomendaciones, fuentes o notas de seguimiento.]'),
  bodyParagraph('PREPARADO POR                                     REVISADO POR'),
  bodyParagraph('__________________________________       __________________________________'),
  bodyParagraph('[Nombre y cargo]                                     [Nombre y cargo]'),
]);
const manual = makeDocument('Manual de usuario de FincaControl', 'Guía para operar FincaControl', [
  { label: 'VERSIÓN', value: version },
  { label: 'CREADOR', value: 'Oscar David Vega Daza' },
  { label: 'ACTUALIZADO', value: updated },
], await manualBody(manualSource));
const scriptArgs = process.argv.slice(2);
const templateOnly = scriptArgs.includes('--template-only');
const manualOnly = scriptArgs.includes('--manual-only');
const customOutput = scriptArgs.find((argument) => !argument.startsWith('--'));
const templateOutput = customOutput && !manualOnly
  ? path.resolve(customOutput)
  : path.join(root, 'documentacion', 'Plantilla_FincaControl_aprobada.dotx');
const manualOutput = customOutput && manualOnly
  ? path.resolve(customOutput)
  : path.join(root, 'guia', 'Manual_Usuario_FincaControl.docx');

if (!templateOnly) {
  await writeFile(
    manualOutput,
    await Packer.toBuffer(manual),
  );
}
if (!manualOnly) await writeDotx(template, templateOutput);
