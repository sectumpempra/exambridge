import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const finalReviewPath = path.join(candidateRoot, "final-machine-review.json");
const outputPath = path.join(candidateRoot, "codex-final-dispositions.json");

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filePath);
}

const mappingFiles = (await readdir(path.join(activeRoot, "mappings")))
  .filter((file) => file.endsWith(".json"))
  .sort();
const mappings = await Promise.all(mappingFiles.map(async (file) => (
  JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8"))
)));
const statementIndex = new Map();
for (const mapping of mappings) {
  for (const statement of mapping.statements) {
    statementIndex.set(statement.statementId, {
      qualificationVersionId: mapping.qualificationVersionId,
      statement,
    });
  }
}
const finalReview = JSON.parse(await readFile(finalReviewPath, "utf8"));
const unresolvedStatementIds = new Set((finalReview.unresolved ?? []).map((item) => item.statementId));

function evidence(statementId, candidates) {
  const statement = statementIndex.get(statementId)?.statement;
  if (!statement) throw new Error(`Unknown disposition statement ${statementId}`);
  const sources = [statement.statementText, ...statement.notesText, ...statement.examplesText];
  const match = candidates.find((candidate) => sources.some((source) => source.includes(candidate)));
  if (!match) throw new Error(`${statementId}: no exact evidence candidate matched`);
  return match;
}

function addition(statementId, nodeId, candidates, relation = "exact", assessmentDepth = "application", notes = []) {
  const indexed = statementIndex.get(statementId);
  if (!indexed) throw new Error(`Unknown disposition statement ${statementId}`);
  return {
    qualificationVersionId: indexed.qualificationVersionId,
    statementId,
    nodeId,
    relation,
    assessmentDepth,
    evidenceSpan: evidence(statementId, candidates),
    reviewNotes: notes.length ? notes : [
      "Codex resolved a final-review ontology gap against the complete official statement, notes and examples.",
    ],
    reviewStatus: "codex-reviewed",
    reviewPass: 3,
  };
}

function ontologyNode({
  nodeId,
  parentNodeId,
  name,
  definition,
  aliases = [],
  objectScopes = [],
  inclusions = [],
  exclusions = [],
  statements,
}) {
  return {
    nodeId,
    parentNodeId,
    name,
    definition,
    aliases,
    dimension: "not-applicable",
    objectScopes,
    inclusions,
    exclusions,
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    reviewStatus: "codex-reviewed",
    stageDepth: "advanced",
    sourceHints: statements.map((item) => item.statementId),
    statements,
  };
}

const existingNodeAdditions = [
  addition("Edexcel-9FM0-OFFICIAL-Edexcel-9FM0-CP-1.1", "NUM-SYS-TYPE-FACT", ["divisibility"], "partial", "proof"),
  addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-S3-1.1", "PROB-DIST-NORM-V5BA75E084", ["Distribution of linear combinations of independent Normal random variables"]),
  addition("OCR-H240-OFFICIAL-OCR-H240-1.10e", "VECT-BASIC-NOTN-V551FD2F1C", ["displacement vector, component vector, resultant vector, parallel vector, equal vector and unit vector"]),
  addition("OCR-H640-OCR-H640-My1", "MECH-FURT-PROJ-RANGE", ["Maximum range on inclined plane"], "partial", "reasoning"),
  addition("OCR-H640-OCR-H640-My1", "MECH-FURT-PROJ-TRAJ", ["Bounding parabola"], "partial", "reasoning"),
  addition("WJEC-3300-OFFICIAL-WJEC-3300-H-GEO-011", "GEOM-CONS-TRAN-ROTA", ["clockwise and anticlockwise turns"], "partial", "knowledge"),
  addition("Edexcel-9MA0-OFFICIAL-Edexcel-9MA0-5.1", "PROB-DIST-BINO-MEAN", ["expected value of a binomial distribution is given by np"], "exact", "knowledge"),
  addition("OCR-6993-OFFICIAL-OCR-6993-NM4", "ALGF-FUNC-DEFS-V5AB360827", ["Use a chord to estimate gradient of a tangent"], "exact", "application"),
  addition("WJEC-C00-4968-0-p32-r5-b0-l2", "GEOM-SHAP-ANGL-ISOS", ["Angle properties of right-angled, isosceles and equilateral triangles"], "partial", "application"),
  addition("WJEC-C00-4968-0-p32-r5-b0-l2", "GEOM-SHAP-ANGL-TRIA", ["Angle properties of right-angled, isosceles and equilateral triangles"], "partial", "application"),
];

const ontologyAdditions = [
  ontologyNode({
    nodeId: "GEOM-SHAP-TERM-VERT",
    parentNodeId: "GEOM-SHAP-TERM",
    name: "Vertex of a geometric figure",
    definition: "A corner point at which two or more sides, edges or rays of a geometric figure meet.",
    aliases: ["geometric vertex", "corner"],
    objectScopes: ["2D figures", "3D solids"],
    inclusions: ["vertices of polygons", "vertices of solids"],
    exclusions: ["vertex of a network graph", "turning point of a function graph"],
    statements: [
      addition("CAIE-0580-CAIE-0580-C4.1", "GEOM-SHAP-TERM-VERT", ["vertex"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-FUNC-GRAP-CUBS",
    parentNodeId: "ALGF-FUNC-GRAP",
    name: "Symmetry of cubic graphs",
    definition: "Recognising and using the rotational or point symmetry of a cubic function graph about its point of inflection.",
    aliases: ["cubic graph symmetry", "point symmetry of a cubic"],
    objectScopes: ["2D cubic function graphs"],
    inclusions: ["centre of rotational symmetry"],
    exclusions: ["line symmetry of quadratic graphs"],
    statements: [
      addition("CAIE-0580-OFFICIAL-CAIE-0580-E2.11-3", "ALGF-FUNC-GRAP-CUBS", ["Knowledge of turning points, roots and symmetry is required."], "exact", "reasoning"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-FUNC-GRAP-MODX",
    parentNodeId: "ALGF-FUNC-GRAP",
    name: "Graphs of y = f(|x|)",
    definition: "Constructing and interpreting y=f(|x|) by reflecting the non-negative-x part of y=f(x) in the y-axis.",
    aliases: ["input modulus graph", "graph of f absolute x"],
    objectScopes: ["2D function graphs"],
    inclusions: ["even symmetry created by replacing x with |x|"],
    exclusions: ["graphs of y=|f(x)|"],
    statements: [
      addition("CAIE-9231-OFFICIAL-CAIE-9231-1.2-GRAPHRELS", "ALGF-FUNC-GRAP-MODX", ["y = f(|x|)"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "STAT-SUMM-CENT-VARI",
    parentNodeId: "STAT-SUMM-CENT",
    name: "Variance of a data set",
    definition: "The mean squared deviation of data values from their mean, used as a measure of dispersion before taking its square root for standard deviation.",
    aliases: ["data variance", "measure of variance"],
    objectScopes: ["raw data", "grouped data"],
    inclusions: ["population variance", "sample descriptive variance"],
    exclusions: ["variance of an abstract random variable", "standard deviation"],
    statements: [
      addition("Edexcel-8MA0-OFFICIAL-Edexcel-8MA0-2.3a", "STAT-SUMM-CENT-VARI", ["Measures of variation: variance"], "exact", "application"),
      addition("Edexcel-9MA0-OFFICIAL-Edexcel-9MA0-2.3-3", "STAT-SUMM-CENT-VARI", ["Measures of variation: variance"], "exact", "application"),
      addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-S1-2.3", "STAT-SUMM-CENT-VARI", ["variance, standard deviation"], "exact", "application"),
      addition("OCR-H240-2.02f", "STAT-SUMM-CENT-VARI", ["standard deviation and variance"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-SEQ-SEQU-SEC2",
    parentNodeId: "ALGF-SEQ-SEQU",
    name: "Second-order linear recurrence relations",
    definition: "Solving second-order linear recurrence relations with constant coefficients by an auxiliary equation, complementary function and particular solution.",
    aliases: ["second-order difference equations", "order-two recurrences"],
    objectScopes: ["homogeneous recurrences", "non-homogeneous recurrences"],
    inclusions: ["distinct, repeated and complex auxiliary roots"],
    exclusions: ["first-order recurrences", "continuous differential equations"],
    statements: [
      addition("Edexcel-9FM0-6.2", "ALGF-SEQ-SEQU-SEC2", ["second order linear homogeneous and non-homogeneous recurrence relations"], "exact", "application"),
      addition("OCR-H245-OFFICIAL-OCR-H245-Y545-8.01g", "ALGF-SEQ-SEQU-SEC2", ["second-order linear recurrence relation with constant coefficients"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-SEQ-SERS-ARPF",
    parentNodeId: "ALGF-SEQ-SERS",
    name: "Proof of the arithmetic-series sum",
    definition: "Deriving the finite arithmetic-series sum formula rather than only substituting values into it.",
    aliases: ["proof of arithmetic progression sum"],
    objectScopes: ["finite arithmetic series"],
    inclusions: ["pairing first and last terms"],
    exclusions: ["using the formula without proof"],
    statements: [
      addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-P2-4.2", "ALGF-SEQ-SERS-ARPF", ["The proof of the sum formula should be known."], "exact", "proof"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-SEQ-SERS-GEPF",
    parentNodeId: "ALGF-SEQ-SERS",
    name: "Proof of the finite geometric-series sum",
    definition: "Deriving the finite geometric-series sum formula by multiplying by the common ratio and subtracting.",
    aliases: ["proof of geometric progression sum"],
    objectScopes: ["finite geometric series"],
    inclusions: ["derivation of the finite sum formula"],
    exclusions: ["sum to infinity", "using the formula without proof"],
    statements: [
      addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-P2-4.4", "ALGF-SEQ-SERS-GEPF", ["The proof of the sum formula for a finite series should be known."], "exact", "proof"),
    ],
  }),
  ontologyNode({
    nodeId: "PROB-DRVD-DRVB-CDF",
    parentNodeId: "PROB-DRVD-DRVB",
    name: "Discrete cumulative distribution function",
    definition: "For a discrete random variable, F(x)=P(X≤x), found by summing its probability mass function over values not exceeding x.",
    aliases: ["discrete CDF"],
    objectScopes: ["discrete random variables"],
    inclusions: ["cumulative probabilities from a probability table"],
    exclusions: ["continuous CDF obtained from a density"],
    statements: [
      addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-S1-5.2", "PROB-DRVD-DRVB-CDF", ["cumulative distribution function for a discrete random variable"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "STAT-ENQ-SAMP-CLUS",
    parentNodeId: "STAT-ENQ-SAMP",
    name: "Cluster sampling",
    definition: "Dividing a population into natural groups, selecting one or more whole groups, and sampling members from the selected clusters.",
    aliases: ["cluster sample"],
    objectScopes: ["survey populations"],
    inclusions: ["selection by naturally occurring groups"],
    exclusions: ["stratified sampling from every stratum"],
    statements: [
      addition("OCR-H240-OFFICIAL-OCR-H240-2.01d", "STAT-ENQ-SAMP-CLUS", ["cluster and quota sampling"], "partial", "reasoning"),
    ],
  }),
  ontologyNode({
    nodeId: "STAT-DATA-REPR-DOTP",
    parentNodeId: "STAT-DATA-REPR",
    name: "Dot plots",
    definition: "A statistical display placing one dot for each observation above its value on a number line so frequencies appear as vertical stacks.",
    aliases: ["dot diagram"],
    objectScopes: ["single-variable numerical data"],
    inclusions: ["interpreting distribution shape and frequency"],
    exclusions: ["scatter diagrams", "pictograms"],
    statements: [
      addition("OCR-H240-OFFICIAL-OCR-H240-2.02a", "STAT-DATA-REPR-DOTP", ["dot plots"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "VECT-BASIC-NOTN-SVEC",
    parentNodeId: "VECT-BASIC-NOTN",
    name: "Scalar and vector distinction",
    definition: "Distinguishing a scalar, which has magnitude only, from a vector, which has both magnitude and direction.",
    aliases: ["scalar versus vector"],
    objectScopes: ["quantities", "vector notation"],
    inclusions: ["classifying quantities as scalar or vector"],
    exclusions: ["scalar multiplication of a vector"],
    statements: [
      addition("OCR-H240-OFFICIAL-OCR-H240-1.10a", "VECT-BASIC-NOTN-SVEC", ["difference between a scalar and a vector"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-FORC-EQUI-CONP",
    parentNodeId: "MECH-FORC-EQUI",
    name: "Equilibrium of connected particles",
    definition: "Applying equilibrium conditions to particles connected by strings or smooth pulleys when the acceleration of each particle is zero.",
    aliases: ["connected particles in equilibrium"],
    objectScopes: ["particles", "strings", "smooth pulleys"],
    inclusions: ["common tension under ideal-string assumptions"],
    exclusions: ["connected particles with non-zero common acceleration"],
    statements: [
      addition("OCR-H240-OFFICIAL-OCR-H240-3.03n", "MECH-FORC-EQUI-CONP", ["including connected particles and smooth pulleys"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "NUM-SYS-TYPE-COMP",
    parentNodeId: "NUM-SYS-TYPE",
    name: "Composite numbers",
    definition: "Natural numbers greater than 1 that have more than two positive factors and therefore are not prime.",
    aliases: ["composite integer"],
    objectScopes: ["positive integers"],
    inclusions: ["classification by factor count"],
    exclusions: ["prime numbers", "the number 1"],
    statements: [
      addition("OCR-H245-OFFICIAL-OCR-H245-Y545-8.02i", "NUM-SYS-TYPE-COMP", ["composite numbers"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-KIN-LINE-ATGR",
    parentNodeId: "MECH-KIN-LINE",
    name: "Acceleration-time graphs",
    definition: "Drawing and interpreting acceleration against time for straight-line motion, including the physical meaning of its values and area where appropriate.",
    aliases: ["acceleration-time graph"],
    objectScopes: ["straight-line kinematics"],
    inclusions: ["constant and variable acceleration"],
    exclusions: ["velocity-time graphs", "displacement-time graphs"],
    statements: [
      addition("OCR-H640-OCR-H640-k4", "MECH-KIN-LINE-ATGR", ["acceleration-time"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-FURT-PROJ-INCL",
    parentNodeId: "MECH-FURT-PROJ",
    name: "Projectile range on an inclined plane",
    definition: "Determining the range of a projectile measured to its intersection with an inclined plane and identifying conditions for maximum range.",
    aliases: ["inclined-plane projectile range"],
    objectScopes: ["projectile motion", "inclined planes"],
    inclusions: ["maximum range on an inclined plane"],
    exclusions: ["horizontal-plane range only"],
    statements: [
      addition("OCR-H640-OCR-H640-My1", "MECH-FURT-PROJ-INCL", ["Maximum range on inclined plane"], "exact", "reasoning"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-FURT-PROJ-BPAR",
    parentNodeId: "MECH-FURT-PROJ",
    name: "Bounding parabola of projectile trajectories",
    definition: "The envelope parabola that bounds all projectile trajectories launched from a fixed point with a fixed initial speed.",
    aliases: ["projectile safety parabola", "bounding parabola"],
    objectScopes: ["families of projectile trajectories"],
    inclusions: ["derivation or use of the envelope"],
    exclusions: ["one projectile trajectory"],
    statements: [
      addition("OCR-H640-OCR-H640-My1", "MECH-FURT-PROJ-BPAR", ["Bounding parabola"], "exact", "reasoning"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-GRAV-INVS",
    parentNodeId: "MECH",
    name: "Inverse-square law of gravitation",
    definition: "Gravitational force or field strength varies inversely with the square of distance from the attracting mass.",
    aliases: ["inverse square gravitation"],
    objectScopes: ["point masses", "spherically symmetric bodies"],
    inclusions: ["1/r² dependence"],
    exclusions: ["constant-g approximation near Earth's surface"],
    statements: [
      addition("OCR-H640-OCR-H640-F2-2", "MECH-GRAV-INVS", ["Inverse square law for gravitation"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-FORC-EQUI-AFRI",
    parentNodeId: "MECH-FORC-EQUI",
    name: "Angle of friction",
    definition: "The angle between the resultant contact force and the normal reaction at limiting equilibrium, satisfying tan φ=μ.",
    aliases: ["friction angle"],
    objectScopes: ["rough contact", "limiting equilibrium"],
    inclusions: ["relation between angle of friction and coefficient of friction"],
    exclusions: ["angle of repose unless derived under its conditions"],
    statements: [
      addition("OCR-H640-OCR-H640-F11", "MECH-FORC-EQUI-AFRI", ["angle of friction"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-FURT-RIGD-VMOM",
    parentNodeId: "MECH-FURT-RIGD",
    name: "Vector moment of a force",
    definition: "Representing the moment of a force about a point or axis by the vector cross product r×F and interpreting its direction.",
    aliases: ["vector torque"],
    objectScopes: ["2D or 3D force systems"],
    inclusions: ["cross-product treatment of moments"],
    exclusions: ["scalar force times perpendicular distance only"],
    statements: [
      addition("OCR-H640-OCR-H640-MF13", "MECH-FURT-RIGD-VMOM", ["Vector treatment"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "GEOM-SHAP-TERM-DGNL",
    parentNodeId: "GEOM-SHAP-TERM",
    name: "Diagonal of a polygon or solid",
    definition: "A line segment joining two non-adjacent vertices of a polygon, or corresponding non-adjacent vertices of a solid.",
    aliases: ["geometric diagonal"],
    objectScopes: ["polygons", "polyhedra"],
    inclusions: ["quadrilateral diagonals"],
    exclusions: ["diagonal entries of a matrix", "sloping lines generally"],
    statements: [
      addition("WJEC-3300-OFFICIAL-WJEC-3300-H-GEO-012", "GEOM-SHAP-TERM-DGNL", ["diagonal"], "exact", "knowledge"),
      addition("WJEC-C00-4968-0-3.1.1-2", "GEOM-SHAP-TERM-DGNL", ["horizontal, vertical, diagonal"], "partial", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "GEOM-SHAP-ANGL-RGHT",
    parentNodeId: "GEOM-SHAP-ANGL",
    name: "Angle properties of right-angled triangles",
    definition: "A right-angled triangle has one 90-degree angle, so its other two interior angles are complementary.",
    aliases: ["right-triangle angle facts"],
    objectScopes: ["plane right-angled triangles"],
    inclusions: ["two acute angles sum to 90 degrees"],
    exclusions: ["Pythagoras", "right-angle trigonometry"],
    statements: [
      addition("WJEC-C00-4968-0-p32-r5-b0-l2", "GEOM-SHAP-ANGL-RGHT", ["Angle properties of right-angled, isosceles and equilateral triangles"], "partial", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "GEOM-SHAP-ANGL-EQUI",
    parentNodeId: "GEOM-SHAP-ANGL",
    name: "Angle properties of equilateral triangles",
    definition: "Every interior angle of a plane equilateral triangle is 60 degrees.",
    aliases: ["equilateral-triangle angle facts"],
    objectScopes: ["plane equilateral triangles"],
    inclusions: ["three equal 60-degree angles"],
    exclusions: ["equal sides without angle reasoning"],
    statements: [
      addition("WJEC-C00-4968-0-p32-r5-b0-l2", "GEOM-SHAP-ANGL-EQUI", ["Angle properties of right-angled, isosceles and equilateral triangles"], "partial", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-LOG-LOGR-INEQ",
    parentNodeId: "ALGF-LOG-LOGR",
    name: "Exponential and logarithmic inequalities",
    definition: "Using logarithms and monotonicity to solve inequalities in which the unknown occurs in an exponent or logarithm.",
    aliases: ["exponential inequalities", "logarithmic inequalities"],
    objectScopes: ["real exponential functions", "real logarithms"],
    inclusions: ["inequalities such as 2^x<5"],
    exclusions: ["exponential equations", "generic polynomial inequalities"],
    statements: [
      addition("CAIE-9709-OFFICIAL-CAIE-9709-P3-3.2.3", "ALGF-LOG-LOGR-INEQ", ["inequalities in which the unknown appears in indices"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-EQN-QUAD-SOLV",
    parentNodeId: "ALGF-EQN-QUAD",
    name: "Solving quadratic equations by an appropriate method",
    definition: "Solving a quadratic equation when no single method is prescribed, selecting factorisation, completing the square, the quadratic formula or another valid method.",
    aliases: ["general quadratic solving"],
    objectScopes: ["one-variable quadratic equations"],
    inclusions: ["method selection"],
    exclusions: ["forming a quadratic equation without solving it"],
    statements: [
      addition("Edexcel-4MA1-OFFICIAL-Edexcel-4MA1-2.7-3", "ALGF-EQN-QUAD-SOLV", ["solve quadratic equations"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-POLY-PART-CUBC",
    parentNodeId: "ALGF-POLY-PART",
    name: "Partial fractions with an unfactorised cubic denominator",
    definition: "Decomposing an algebraic fraction when a cubic denominator factor is left unfactorised over the coefficient domain used by the qualification.",
    aliases: ["irreducible cubic partial fractions"],
    objectScopes: ["rational functions"],
    inclusions: ["linear numerator over an unfactorised cubic factor where required"],
    exclusions: ["distinct linear factors", "irreducible quadratic factors"],
    statements: [
      addition("OCR-H640-OFFICIAL-OCR-H640-a15", "ALGF-POLY-PART-CUBC", ["cubic which cannot be factorised in the denominator"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "MECH-KIN-LINE-DERI",
    parentNodeId: "MECH-KIN-LINE",
    name: "Derivation of constant-acceleration formulae",
    definition: "Deriving the standard constant-acceleration equations from velocity definitions, averages or integration, rather than only applying them.",
    aliases: ["derivation of SUVAT"],
    objectScopes: ["straight-line constant acceleration"],
    inclusions: ["deriving v=u+at and related equations"],
    exclusions: ["formula substitution without derivation"],
    statements: [
      addition("OCR-H640-OCR-H640-k7", "MECH-KIN-LINE-DERI", ["Learners should be able to derive the formulae."], "exact", "proof"),
    ],
  }),
  ontologyNode({
    nodeId: "NUM-SYS-TYPE-PARI",
    parentNodeId: "NUM-SYS-TYPE",
    name: "Odd and even integers",
    definition: "Classifying integers by parity: even integers are divisible by 2 and odd integers leave remainder 1 in absolute parity terms.",
    aliases: ["parity", "odd and even numbers"],
    objectScopes: ["integers"],
    inclusions: ["odd/even properties"],
    exclusions: ["prime/composite classification"],
    statements: [
      addition("WJEC-3300-OFFICIAL-WJEC-3300-N-1.7", "NUM-SYS-TYPE-PARI", ["odd, even"], "exact", "knowledge"),
      addition("OCR-J560-OFFICIAL-OCR-J560-1.02a", "NUM-SYS-TYPE-PARI", ["terms odd, even"], "exact", "knowledge"),
    ],
  }),
  ontologyNode({
    nodeId: "ALGF-MATR-EIG-POWR",
    parentNodeId: "ALGF-MATR-EIG",
    name: "Matrix powers by diagonalisation",
    definition: "Computing integer powers A^n from a diagonalisation A=QDQ⁻¹ by using A^n=QD^nQ⁻¹.",
    aliases: ["powers via diagonalisation"],
    objectScopes: ["diagonalisable square matrices"],
    inclusions: ["2x2 and 3x3 matrix powers"],
    exclusions: ["Cayley-Hamilton reduction"],
    statements: [
      addition("CAIE-9231-OFFICIAL-CAIE-9231-2.2.5", "ALGF-MATR-EIG-POWR", ["calculating powers of 2 × 2 or 3 × 3 matrices"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "CALC-HYP-HYP-EQNS",
    parentNodeId: "CALC-HYP-HYP",
    name: "Hyperbolic equations",
    definition: "Solving equations involving hyperbolic functions by exponential definitions, identities or inverse hyperbolic functions.",
    aliases: ["solving hyperbolic equations"],
    objectScopes: ["real hyperbolic functions"],
    inclusions: ["a cosh x + b sinh x = c"],
    exclusions: ["ordinary trigonometric equations"],
    statements: [
      addition("Edexcel-IAL-OFFICIAL-Edexcel-IAL-FP3-1.1", "CALC-HYP-HYP-EQNS", ["solve equations such as a cosh x + b sinh x = c"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "STAT-BIVA-CORR-LINZ",
    parentNodeId: "STAT-BIVA-CORR",
    name: "Linearising nonlinear data relationships",
    definition: "Applying a change of variable to turn a power or exponential relationship into a straight-line form so model parameters can be estimated.",
    aliases: ["linearisation by variable transformation"],
    objectScopes: ["bivariate data", "power models", "exponential models"],
    inclusions: ["linearising y=ax^n or y=kb^x"],
    exclusions: ["ordinary least-squares calculation", "linear data already in straight-line form"],
    statements: [
      addition("Edexcel-9MA0-OFFICIAL-Edexcel-9MA0-2.2", "STAT-BIVA-CORR-LINZ", ["A change of variable may linearise y = axⁿ or y = kbˣ"], "exact", "application"),
    ],
  }),
  ontologyNode({
    nodeId: "NUM-MOD-CONG-SIMU",
    parentNodeId: "NUM",
    name: "Simultaneous linear congruences",
    definition: "Solving two or more linear congruences for a common integer solution, with the Chinese remainder theorem available when its conditions apply.",
    aliases: ["simultaneous modular equations"],
    objectScopes: ["integer congruences"],
    inclusions: ["ax congruent to b modulo n", "Chinese remainder theorem"],
    exclusions: ["simultaneous real linear equations"],
    statements: [
      addition("OCR-H245-OFFICIAL-OCR-H245-Y545-8.02h", "NUM-MOD-CONG-SIMU", ["simultaneous linear congruences of the form ax ≡ b (mod n)"], "exact", "application"),
    ],
  }),
];

const noChangeDispositions = [
  ["Edexcel-9MA0-OFFICIAL-OT1.1", "The official mathematical-practice requirements are already linked to logical reasoning, symbolic notation and communication nodes; they do not require another mathematical-knowledge leaf."],
  ["OCR-H240-OFFICIAL-OCR-H240-1.05l", "The atomic requirement is already linked to the addition and double-angle formulae. Its note lists possible applications, not additional standalone content requirements that should be duplicated on this statement."],
  ["OCR-H640-OFFICIAL-OCR-H640-Mc10", "The existing exponential and logarithmic differentiation links cover e^kx, a^kx and ln x; the inner linear factor is represented within the rule rather than as a separate missing concept."],
  ["Edexcel-1MA1-A5a", "The statement is already linked to the standard-formula mathematical-practice node, which is intentionally excluded from mathematical-knowledge similarity scoring."],
  ["OCR-6993-OFFICIAL-OCR-6993-AL6", "The statement already links every explicitly named linear, quadratic, cubic and simultaneous-equation family; no unsupported generic duplicate leaf is needed."],
  ["OCR-H240-OFFICIAL-OCR-H240-1.05k-2", "The statement already links the named identities, trigonometric-equation methods, identity proof and identity-based integration concepts."],
  ["OCR-J560-OFFICIAL-J560-8.01e", "The existing GEOM-SHAP-TERM-DIAG link exactly represents drawing a diagram from a written geometric description."],
  ["CAIE-0580-CAIE-0580-C5.4-2", "The existing prism node explicitly covers solids with uniform cross-section; the note's cylindrical sector is an example of that declared scope, not a separate missing concept."],
  ["CAIE-9231-OFFICIAL-CAIE-9231-2.4.1", "The existing advanced hyperbolic integration, trigonometric substitution and hyperbolic substitution leaves cover all three standard radical forms and the specified technique."],
  ["OCR-H245-4.10b", "The existing first-order differential-equation setup, solution, linear ODE modelling and variable-force mechanics links already cover the stated modelling requirement."],
  ["WJEC-C00-4968-0-2.1.5-2", "The statement already links forming algebraic expressions and simplifying like terms; no broader duplicate leaf is needed."],
];

const flattenedOntologyAdditions = ontologyAdditions.flatMap((node) => node.statements);
const allAdditions = [...existingNodeAdditions, ...flattenedOntologyAdditions];
const dispositionStatementIds = new Set([
  ...allAdditions.map((item) => item.statementId),
  ...noChangeDispositions.map(([statementId]) => statementId),
]);
const missingDispositions = [...unresolvedStatementIds].filter((statementId) => !dispositionStatementIds.has(statementId));
const unexpectedDispositions = [...dispositionStatementIds].filter((statementId) => !unresolvedStatementIds.has(statementId));
if (missingDispositions.length || unexpectedDispositions.length) {
  throw new Error(JSON.stringify({ missingDispositions, unexpectedDispositions }, null, 2));
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  sourceReview: "final-machine-review.json",
  reviewStatus: "codex-reviewed",
  provider: "local",
  requestedModel: "local",
  returnedModel: "local",
  unresolvedEntryCount: finalReview.unresolvedCount,
  unresolvedStatementCount: unresolvedStatementIds.size,
  resolvedStatementCount: dispositionStatementIds.size,
  additionCount: allAdditions.length,
  ontologyAdditionCount: ontologyAdditions.length,
  noChangeCount: noChangeDispositions.length,
  unresolvedAfterDisposition: 0,
  additions: allAdditions,
  ontologyAdditions: ontologyAdditions.map(({ statements, ...node }) => node),
  noChangeDispositions: noChangeDispositions.map(([statementId, reason]) => ({
    qualificationVersionId: statementIndex.get(statementId).qualificationVersionId,
    statementId,
    reason,
    reviewStatus: "codex-reviewed",
  })),
};
await atomicWrite(outputPath, report);
console.log(JSON.stringify({
  unresolvedEntryCount: report.unresolvedEntryCount,
  unresolvedStatementCount: report.unresolvedStatementCount,
  additionCount: report.additionCount,
  ontologyAdditionCount: report.ontologyAdditionCount,
  noChangeCount: report.noChangeCount,
  unresolvedAfterDisposition: report.unresolvedAfterDisposition,
}));
