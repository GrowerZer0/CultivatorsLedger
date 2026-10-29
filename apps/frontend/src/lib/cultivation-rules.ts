export type Stage = "seedling" | "vegetative" | "flowering" | "dry" | "cure";

export function getEnvironmentTargets(stage: Stage) {
  switch (stage) {
    case "seedling":
      return { vpdMin: 0.4, vpdMax: 0.8, rhTarget: 70, note: "Keep dome on, high humidity." };
    case "vegetative":
      return { vpdMin: 0.8, vpdMax: 1.2, rhTarget: 60, note: "Standard veg environment." };
    case "flowering":
      return { vpdMin: 1.0, vpdMax: 1.5, rhTarget: 45, note: "Lower RH to prevent bud rot." };
    case "dry":
      return { vpdMin: 0.8, vpdMax: 1.2, rhTarget: 60, note: "Target 60°F / 60% RH. Keep dark." };
    case "cure":
      return { vpdMin: 0, vpdMax: 0, rhTarget: 62, note: "Target 62% RH in jars." };
  }
}

export function getWeeklyActions(stage: Stage, week: number) {
  const actions: string[] = [];
  
  if (stage === "vegetative") {
    if (week === 1) actions.push("Keep dome on. Check for stretching.");
    if (week === 3) actions.push("Remove humidity dome.");
    if (week === 4) actions.push("Start topping (at 4th node).");
    if (week === 6) actions.push("Prepare to flip to 12/12. Defoliate bottom half.");
  }
  
  if (stage === "flowering") {
    if (week === 1) actions.push("Trellis the plant as it stretches.");
    if (week === 2) actions.push("Check for male pollen sacs. Remove any males.");
    if (week === 3) actions.push("Defoliate lower growth.");
    if (week >= 8) actions.push("Check trichomes with a loupe. Milky = peak THC.");
  }

  if (stage === "dry") {
    if (week === 1) actions.push("Check weight daily. Target 60/60.");
    if (week >= 2) actions.push("Check stem snap. If it snaps, move to cure.");
  }

  return actions;
}

export function getFeedSchedule(substrate: string, nutrientLine: string, stage: Stage, week: number) {
  // GH Flora Trio + Happy Frog Schedule
  if (substrate === "happy_frog" && nutrientLine === "gh_flora") {
    if (stage === "vegetative") {
      if (week === 1) return "Plain water only (1 cup when dry).";
      if (week === 2) return "Plain water only (2-3 cups).";
      if (week === 3) return "CalMag 1, Micro 2, Grow 1, Bloom 1 (ml/gal). pH 6.3.";
      if (week === 4) return "CalMag 1, Micro 4, Grow 1, Bloom 2 (ml/gal). pH 6.3.";
      if (week === 5) return "CalMag 1, Micro 5, Grow 1, Bloom 3 (ml/gal). pH 6.3.";
      if (week >= 6) return "CalMag 1, Micro 6, Grow 1, Bloom 3 (ml/gal). pH 6.4.";
    }
    if (stage === "flowering") {
      if (week === 1) return "CalMag 1, Micro 5, Grow 2, Bloom 5 (ml/gal). pH 6.4.";
      if (week === 2) return "CalMag 1, Micro 4, Grow 3, Bloom 6 (ml/gal). pH 6.5.";
      if (week === 3) return "CalMag 1, Micro 4, Grow 4, Bloom 7 (ml/gal). pH 6.5.";
      if (week >= 4 && week <= 5) return "CalMag 1, Micro 4, Grow 3, Bloom 9 (ml/gal). pH 6.4.";
      if (week >= 6) return "CalMag 1, Micro 4, Grow 3, Bloom 9 (ml/gal). pH 6.4. Flush before harvest.";
    }
  }
  
  // Fallback for other setups
  return "Follow your standard feed chart for this week.";
}