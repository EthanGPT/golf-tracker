import { describe, expect, it } from "vitest";
import { normalizeCourse, parseGolfTraxxHtml, parseKmlPlacemarks, polygonCentre, resolveOsmGeometry } from "./courseIngestion";

describe("course ingestion", () => {
  it("derives a centre from an external green polygon", () => {
    expect(
      polygonCentre([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 2 },
        { latitude: 2, longitude: 0 },
      ]),
    ).toEqual({ latitude: 1, longitude: 1 });
  });

  it("normalizes greens, tees and hazards while preserving provenance", () => {
    const result = normalizeCourse(
      {
        externalId: "demo",
        name: "Demo",
        latitude: 1,
        longitude: 2,
        tees: [{ id: "white", name: "White" }],
        holes: [{ number: 1, par: 4, distancesM: { white: 300 } }],
      },
      {
        fetchedAt: "2026-01-01",
        attribution: "© OpenStreetMap contributors",
        features: [
          {
            id: "way/green",
            kind: "green",
            ref: "1",
            points: [
              { latitude: 1, longitude: 2 },
              { latitude: 1, longitude: 2.001 },
              { latitude: 1.001, longitude: 2.001 },
              { latitude: 1.001, longitude: 2 },
            ],
            provenance: {
              source: "openstreetmap",
              sourceId: "way/green",
              confidence: "probable",
            },
          },
          {
            id: "way/bunker",
            kind: "bunker",
            ref: "1",
            points: [{ latitude: 1, longitude: 2 }],
            provenance: { source: "openstreetmap", confidence: "probable" },
          },
        ],
      },
    );
    expect(result.course.holes[0].green?.centre).toBeDefined();
    expect(result.course.holes[0].hazards?.[0].type).toBe("bunker");
    expect(result.provenance[0].source).toBe("openstreetmap");
  });

  it("resolves an untagged green only when the numbered hole geometry is a strong match", () => {
    const result = resolveOsmGeometry(
      [
        {
          id: "way/hole-1",
          kind: "hole",
          ref: "1",
          points: [
            { latitude: 0, longitude: 0 },
            { latitude: 0, longitude: 0.001 },
          ],
          provenance: { source: "openstreetmap", confidence: "probable" },
        },
        {
          id: "way/green-1",
          kind: "green",
          points: [
            { latitude: 0.00005, longitude: 0.001 },
            { latitude: 0.00015, longitude: 0.001 },
            { latitude: 0.0001, longitude: 0.0011 },
          ],
          provenance: { source: "openstreetmap", confidence: "probable" },
        },
      ],
      [1],
    );
    expect(result.report.resolvedGreenCount).toBe(1);
    expect(result.report.perHole[1].confidence).toBe("probable");
    expect(result.features.find((feature) => feature.kind === "green")?.ref).toBe("1");
  });

  it("leaves a competing green cluster unresolved", () => {
    const result = resolveOsmGeometry(
      [
        {
          id: "way/hole-1",
          kind: "hole",
          ref: "1",
          points: [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }],
          provenance: { source: "openstreetmap", confidence: "probable" },
        },
        ...["a", "b"].map((id) => ({
          id: `way/green-${id}`,
          kind: "green" as const,
          points: [{ latitude: 0, longitude: 0.001 }, { latitude: 0.0001, longitude: 0.001 }],
          provenance: { source: "openstreetmap" as const, confidence: "probable" as const },
        })),
      ],
      [1],
    );
    expect(result.report.resolvedGreenCount).toBe(0);
    expect(result.report.ambiguousClusters).toHaveLength(1);
  });

  it("extracts explicit GolfTraxx centre and tee-target coordinates", () => {
    const features = parseGolfTraxxHtml(`
      <script>
        var ttlatitude = "-34.4"; var ttlongitude = "19.2";
        var gclatitude = "-34.41"; var gclongitude = "19.21";
      </script>
    `, 19, "https://example.test/hole/1");
    expect(features.map((feature) => feature.kind)).toEqual(["green", "tee"]);
    expect(features[0].ref).toBe("19");
    expect(features[0].provenance.centreMethod).toBe("front-centre-back");
    expect(features[1].points[0]).toEqual({ latitude: -34.4, longitude: 19.2 });
  });

  it("extracts hole-numbered KML placemarks without fabricating unnamed geometry", () => {
    const features = parseKmlPlacemarks(`
      <kml><Document>
        <Placemark><name>Hole 7 Green</name><Polygon><outerBoundaryIs><LinearRing>
          <coordinates>19.2,-34.4,0 19.201,-34.4,0 19.201,-34.401,0</coordinates>
        </LinearRing></outerBoundaryIs></Polygon></Placemark>
        <Placemark><name>Practice area</name><Point><coordinates>19.3,-34.5,0</coordinates></Point></Placemark>
      </Document></kml>
    `);
    expect(features[0].kind).toBe("green");
    expect(features[0].ref).toBe("7");
    expect(features[1].provenance.confidence).toBe("unresolved");
  });
});
