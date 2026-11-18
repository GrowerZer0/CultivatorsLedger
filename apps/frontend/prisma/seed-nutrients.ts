import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up old seed data...");
  // Clean up the old placeholder data
  await prisma.protocolDose.deleteMany({
    where: { protocolId: "athena-blended" },
  });
  await prisma.feedProtocol.deleteMany({
    where: { id: "athena-blended" },
  });
  await prisma.nutrientProduct.deleteMany({
    where: { brand: "Athena" },
  });

  console.log("Seeding Athena Blended products...");

  // 1. Create Products with full label data
  const caMg = await prisma.nutrientProduct.create({
    data: {
      brand: "Athena",
      name: "Blended CaMg",
      category: "calmag",
      pctN: 2.0, pctP: 0.0, pctK: 0.0,
      pctCa: 2.1, pctMg: 1.1, pctFe: 0.06,
      labelSourceUrl: "https://store.athenaag.com/products/blended-camg",
      labelVersion: "Lot 6-251124AM",
    },
  });

  const growA = await prisma.nutrientProduct.create({
    data: {
      brand: "Athena",
      name: "Blended Grow A",
      category: "base",
      pctN: 4.0, pctP: 0.0, pctK: 1.0,
      pctCa: 4.2, pctMg: 0.19,
      labelSourceUrl: "https://store.athenaag.com/products/blended-grow-a",
      labelVersion: "Lot 1-250811AM",
    },
  });

  const growB = await prisma.nutrientProduct.create({
    data: {
      brand: "Athena",
      name: "Blended Grow B",
      category: "base",
      pctN: 1.0, pctP: 3.0, pctK: 5.0,
      pctMg: 0.89, pctS: 1.3, pctCu: 0.005,
      labelSourceUrl: "https://store.athenaag.com/products/blended-grow-b",
      labelVersion: "Lot 2-260527AM",
    },
  });

  const bloomA = await prisma.nutrientProduct.create({
    data: {
      brand: "Athena",
      name: "Blended Bloom A",
      category: "base",
      pctN: 4.0, pctP: 0.0, pctK: 5.0,
      pctCa: 3.2, pctMg: 0.17, pctB: 0.01, pctFe: 0.06,
      pctMn: 0.013, pctMo: 0.0007, pctZn: 0.0045,
      labelSourceUrl: "https://store.athenaag.com/products/blended-bloom-a",
      labelVersion: "Lot 3-260531AM",
    },
  });

  const bloomB = await prisma.nutrientProduct.create({
    data: {
      brand: "Athena",
      name: "Blended Bloom B",
      category: "base",
      pctN: 0.7, pctP: 6.0, pctK: 5.0,
      pctMg: 0.94, pctS: 1.3, pctCu: 0.005,
      labelSourceUrl: "https://store.athenaag.com/products/blended-bloom-b",
      labelVersion: "Lot 4-260521AM",
    },
  });

  console.log("Products created.");

  // 2. Create Protocol
  const athenaBlended = await prisma.feedProtocol.create({
    data: {
      id: "athena-blended",
      brand: "Athena",
      name: "Blended Program",
      mediumTarget: "Coco/Rockwool",
      chartSourceUrl: "https://athenaag.com/feed-schedules/",
      chartVersion: "A01.004",
    },
  });

  console.log("Protocol created.");

  // 3. Create Doses
  // We are re-seeding Week 1 Veg just to verify the new data flows correctly.
  const doses = [
    { productId: growA.id, mlPerGallon: 11.0 },
    { productId: growB.id, mlPerGallon: 11.0 },
    { productId: caMg.id, mlPerGallon: 3.0 },
  ];

  for (const dose of doses) {
    await prisma.protocolDose.create({
      data: {
        protocolId: athenaBlended.id,
        productId: dose.productId,
        stage: "veg",
        week: 1,
        mlPerGallon: dose.mlPerGallon,
        targetPhMin: 5.8,
        targetPhMax: 6.2,
        targetEc: 2.1,
      },
    });
  }

  console.log("Veg Week 1 doses seeded.");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });