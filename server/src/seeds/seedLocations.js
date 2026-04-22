import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

const locations = [
  { region: "Lagos", areas: ["Ikeja", "Lekki", "Yaba", "Surulere"], registrationFee: 10000 },
  { region: "Federal Capital Territory", areas: ["Garki", "Wuse", "Maitama", "Kubwa"], registrationFee: 10000 },
  { region: "Rivers", areas: ["Port Harcourt", "Obio-Akpor", "Eleme"], registrationFee: 9000 },
];

export const seedLocations = async () => {
  try {
    for (const location of locations) {
      await prisma.location.upsert({
        where: { region: location.region },
        update: {
          areas: location.areas,
          registrationFee: location.registrationFee,
          isActive: true,
        },
        create: {
          mongoId: crypto.randomBytes(12).toString("hex"),
          region: location.region,
          areas: location.areas,
          registrationFee: location.registrationFee,
          isActive: true,
        },
      });
    }

    logger.info("Seeded marketplace locations");
  } catch (error) {
    logger.error("Error seeding locations:", error);
    throw error;
  }
};

