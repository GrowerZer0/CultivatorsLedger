import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

function parseDate(str: string): Date | null {
  if (!str || str.trim() === "") return null;
  
  const cleaned = str.trim();
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  
  const match = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
  }
  
  return null;
}

function normalizePlantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_lb$/i, '')
    .replace(/ lbs?$/i, '')
    .replace(/ weight$/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

async function findMatchingPlant(
  name: string, 
  userId: string, 
  existingPlants: Array<{ id: string; name: string }>
) {
  const normalized = normalizePlantName(name);
  const variations = [
    normalized,
    normalized.replace(/\s+/g, ''),
    normalized.replace(/-/g, ''),
    normalized.replace(/_/g, ''),
  ];

  let match = existingPlants.find(p => 
    normalizePlantName(p.name) === normalized
  );
  
  if (match) return match;

  for (const variant of variations) {
    match = existingPlants.find(p => 
      normalizePlantName(p.name).includes(variant) || 
      variant.includes(normalizePlantName(p.name))
    );
    if (match) return match;
  }

  if (normalized.length > 3) {
    const parts = normalized.split(' ');
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length > 2) {
          match = existingPlants.find(p => 
            normalizePlantName(p.name).includes(part) ||
            part.includes(normalizePlantName(p.name))
          );
          if (match) return match;
        }
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim() !== "");
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    // Get all existing plants
    const existingPlants = await db.plant.findMany({
      where: { userId },
      select: { id: true, name: true }
    });

    // Auto-detect weight columns
    const weightColumns: Array<{ index: number; name: string; plantName: string; detectedPlantId?: string | null }> = [];
    headers.forEach((header, index) => {
      if (header.includes('lb') || header.includes('weight')) {
        let plantName = header
          .replace(/_lb$/i, '')
          .replace(/ lbs?$/i, '')
          .replace(/ weight$/i, '')
          .trim();
        
        plantName = plantName.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
        weightColumns.push({ 
          index, 
          name: header,
          plantName,
          detectedPlantId: null
        });
      }
    });

    if (weightColumns.length === 0) {
      return NextResponse.json({ 
        error: "No weight columns found. Looking for columns with 'lb' or 'weight' in the name." 
      }, { status: 400 });
    }

    // Find date column
    const dateCol = headers.findIndex(h => h.includes('date') || h.includes('timestamp'));
    if (dateCol === -1) {
      return NextResponse.json({ error: "No date column found" }, { status: 400 });
    }

    // First pass: Determine plant mapping for each column
    const plantMapping: Record<string, string> = {}; // columnName -> plantId
    const columnMappingDetails: Array<{ column: string; plantName: string; matchedPlant: string | null; status: 'matched' | 'created' | 'unmatched' }> = [];

    for (const col of weightColumns) {
      const matchedPlant = await findMatchingPlant(col.plantName, userId, existingPlants);
      
      if (matchedPlant) {
        plantMapping[col.name] = matchedPlant.id;
        col.detectedPlantId = matchedPlant.id;
        columnMappingDetails.push({
          column: col.name,
          plantName: col.plantName,
          matchedPlant: matchedPlant.name,
          status: 'matched'
        });
      } else {
        // Create new plant
        const newPlant = await db.plant.create({
          data: { 
            name: col.plantName, 
            userId 
          }
        });
        plantMapping[col.name] = newPlant.id;
        col.detectedPlantId = newPlant.id;
        columnMappingDetails.push({
          column: col.name,
          plantName: col.plantName,
          matchedPlant: null,
          status: 'created'
        });
      }
    }

    const weightRecords: any[] = [];
    const errors: string[] = [];

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      
      if (values.every(v => !v)) continue;

      let date: Date | null = null;
      if (values[dateCol]) {
        date = parseDate(values[dateCol]);
      }
      if (!date) {
        errors.push(`Row ${i}: Could not parse date`);
        continue;
      }

      // Process each weight column
      for (const weightCol of weightColumns) {
        const weightStr = values[weightCol.index];
        if (!weightStr || weightStr.trim() === "") continue;
        
        const weight = parseFloat(weightStr);
        if (isNaN(weight) || weight <= 0) continue;

        const plantId = plantMapping[weightCol.name];
        if (!plantId) continue;

        // Get latest dryback to calculate dryback percent
        const latestLog = await db.dryBackLog.findFirst({
          where: { plantId, userId },
          orderBy: { timestamp: "desc" }
        });

        let wetWeight = 0;
        let dryTarget = 0;
        
        if (latestLog) {
          wetWeight = Number(latestLog.wetWeightLbs) || 0;
          dryTarget = Number(latestLog.dryTargetWeightLbs) || 0;
        }

        if (weight > 18 && wetWeight === 0) {
          wetWeight = weight;
          dryTarget = Math.round(wetWeight * 0.72 * 10) / 10;
        }

        let dryBackPercent = 0;
        if (wetWeight > 0 && dryTarget > 0) {
          const range = wetWeight - dryTarget;
          if (range > 0) {
            const lost = wetWeight - weight;
            dryBackPercent = Math.max(0, Math.min(100, (lost / range) * 100));
          }
        }

        weightRecords.push({
          timestamp: date,
          currentWeightLbs: weight,
          plantId,
          userId,
          source: 'csv_import',
          sourceMetadata: { 
            filename: file.name, 
            row: i, 
            plantColumn: weightCol.name 
          },
          containerGallons: 3,
          wetWeightLbs: wetWeight || 18.4,
          dryTargetWeightLbs: dryTarget || 13.2,
          dryBackPercent: dryBackPercent,
          unit: 'lbs',
          notes: `Imported from ${file.name}`
        });
      }
    }

    let imported = 0;
    if (weightRecords.length > 0) {
      try {
        const result = await db.dryBackLog.createMany({
          data: weightRecords,
          skipDuplicates: true,
        });
        imported = result.count;
      } catch (err) {
        console.error("Error importing weight records:", err);
        errors.push(`Failed to import ${weightRecords.length} weight records`);
      }
    }

    if (imported > 0) {
      await db.importHistory.create({
        data: {
          filename: file.name,
          rowsImported: imported,
          importStatus: "completed",
          userId,
        },
      });
    }

    revalidatePath("/");

    return NextResponse.json({
      success: true,
      imported,
      totalRows: lines.length - 1,
      columnMapping: columnMappingDetails,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
