import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../types/errors.js';

export interface FileConnectorRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  file_name: string;
  headers: string[];
  row_count: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
}

/** Simple RFC-4180 compliant CSV parser (no external deps). */
export function parseCsv(text: string): ParsedCsvResult {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  function parseRow(line: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // quoted field
        let val = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            val += '"';
            i += 2;
          } else if (line[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            val += line[i++];
          }
        }
        fields.push(val);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) {
          fields.push(line.slice(i));
          break;
        }
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
    return fields;
  }

  const headers = parseRow(nonEmpty[0]!).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const vals = parseRow(nonEmpty[r]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

function fmt(fc: {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  file_name: string;
  headers: string[];
  row_count: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}): FileConnectorRecord {
  return {
    id: fc.id,
    tenant_id: fc.tenant_id,
    name: fc.name,
    description: fc.description,
    file_name: fc.file_name,
    headers: fc.headers,
    row_count: fc.row_count,
    status: fc.status,
    created_at: fc.created_at.toISOString(),
    updated_at: fc.updated_at.toISOString(),
  };
}

export async function listFileConnectors(tenantId: string): Promise<FileConnectorRecord[]> {
  const items = await prisma.fileConnector.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
  });
  return items.map(fmt);
}

export async function createFileConnector(
  tenantId: string,
  input: { name: string; description?: string; file_name: string; csv_text: string }
): Promise<FileConnectorRecord> {
  const parsed = parseCsv(input.csv_text);
  const fc = await prisma.fileConnector.create({
    data: {
      tenant_id: tenantId,
      name: input.name,
      description: input.description ?? null,
      file_name: input.file_name,
      headers: parsed.headers,
      row_count: parsed.rows.length,
      data: parsed.rows,
    },
  });
  return fmt(fc);
}

export async function deleteFileConnector(tenantId: string, id: string): Promise<boolean> {
  const fc = await prisma.fileConnector.findUnique({ where: { id } });
  if (!fc) return false;
  if (fc.tenant_id !== tenantId) throw new ForbiddenError();
  await prisma.fileConnector.delete({ where: { id } });
  return true;
}

export async function getFileConnectorData(
  tenantId: string,
  id: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const fc = await prisma.fileConnector.findUnique({ where: { id } });
  if (!fc) throw new NotFoundError('FileConnector');
  if (fc.tenant_id !== tenantId) throw new ForbiddenError();
  return { headers: fc.headers, rows: fc.data as Record<string, string>[] };
}
