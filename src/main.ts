
// Type definitions for Wikipedia API responses
interface WikipediaSearchResult {
  query?: {
    search: {
      title: string;
    }[];
  };
}

interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
  };
  content_urls: {
    desktop: {
      page: string;
    };
  };
}

// Initialize the map
const map: L.Map = L.map("map").setView([48.998669, 8.400904], 13);

// Add OSM base layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 30,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);


function loadSimpleLayer(url: string, color: string, fillOpacityVal: number) {
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      return res.json();
    })
    .then((geojson) => {
      const layer = L.geoJSON(geojson, {
        style: {
          color: color,
          weight: 2,
          opacity: 0.8,
          fillOpacity: fillOpacityVal,
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const name = props.name || props.description || "Kein Name vorhanden";

          // Bind the name (or default message) to each feature's popup
          layer.bindPopup(`<b>Name:</b> ${name}`);
        },
      });

      layer.addTo(map);
      map.fitBounds(layer.getBounds());
    })
    .catch((err) => {
      console.error(err);
    });
}

// Function to load and style a GeoJSON layer
function loadGeoJSONLayer(url: string, color: string) {
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      return res.json();
    })
    .then((geojson) => {
      const layer = L.geoJSON(geojson, {
        style: {
          color: color,
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0,

        },
        pointToLayer: (feature, latlng) =>
          L.marker(latlng, {
            // radius: 6,
            // fillColor: color,
            // color: "#000",
            // weight: 1,
            opacity: 1,
            // fillOpacity: 0.7
          }),
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            let lang = "de";
            let title: string | null = null;
          
            // Use `wikipedia` tag if present
            if (props.wikipedia) {
              const parts = props.wikipedia.split(":");
              if (parts.length === 2) {
                lang = parts[0];
                title = parts[1];
              }
            }
          
            // Set initial loading popup
            layer.bindPopup("🔍 Loading Wikipedia summary...").openPopup();
          
            const fetchSummary = (pageTitle: string) => {
              const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
              return fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`)
                .then((res) => {
                  if (!res.ok) throw new Error("Summary not found");
                  return res.json();
                });
            };
          
            const setPopupFromSummary = (data: any) => {
              const imageHtml = data.thumbnail
                ? `<img src="${data.thumbnail.source}" style="width:100%; margin:5px 0; border-radius:6px;" />`
                : "";
          
              const content = `
                <div style="max-width:300px;">
                  <b>${data.title}</b><br>
                  ${imageHtml}
                  ${data.extract}<br>
                  <a href="${data.content_urls.desktop.page}" target="_blank">Read more</a>
                </div>
              `;
              layer.setPopupContent(content);
            };
          
            if (title) {
              fetchSummary(title)
                .then(setPopupFromSummary)
                .catch(() => {
                  layer.setPopupContent("❌ No Wikipedia summary found.");
                });
            } else if (props.name) {
              const search = encodeURIComponent(props.name);
              fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${search}&format=json&origin=*`)
                .then((res) => res.json())
                .then((data) => {
                  const results = data.query?.search;
                  if (results && results.length > 0) {
                    const bestMatch = results[0].title;
                    return fetchSummary(bestMatch);
                  } else {
                    throw new Error("No search results");
                  }
                })
                .then(setPopupFromSummary)
                .catch(() => {
                  layer.setPopupContent("Could not fetch Wikipedia summary.");
                });
            } else {
              layer.setPopupContent("No name or Wikipedia tag found.");
            }
          }
      });

      layer.addTo(map);
      map.fitBounds(layer.getBounds());
    })
    .catch((err) => {
      console.error(err);
    });
}

// Function to load and style a GeoJSON layer
function loadAnimalInfo(url: string, color: string): void {
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      return res.json();
    })
    .then((geojson: GeoJSON.FeatureCollection) => {

      const addMarkerWithPopup = (latlng: [number, number], content: string): void => {
        const marker = L.marker(latlng).addTo(map);
        marker.bindPopup(content);
      };

      const fetchSummary = (pageTitle: string, lang: string, latlng: [number, number]): Promise<void> => {
        const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
        return fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`)
          .then((res) => {
            if (!res.ok) throw new Error("Summary not found");
            return res.json();
          })
          .then((data: WikipediaSummary) => {
            const imageHtml = data.thumbnail
              ? `<img src="${data.thumbnail.source}" style="width:100%; margin:5px 0; border-radius:6px;" />`
              : "";

            const content = `
              <div style="max-width:300px;">
                <b>${data.title}</b><br>
                ${imageHtml}
                ${data.extract}<br>
                <a href="${data.content_urls.desktop.page}" target="_blank">Read more</a>
              </div>
            `;
            addMarkerWithPopup(latlng, content);
          });
      };

      geojson.features.forEach((feature) => {
        if (feature.geometry.type === 'Point') {
          const point = feature.geometry as GeoJSON.Point;
          
          const props = feature.properties || {};
          const latlng: [number, number] = [point.coordinates[1], point.coordinates[0]]; // Reverse coordinates
          let lang = "de";
          let title: string | null = null;

          if (props.wikipedia) {
            const parts = props.wikipedia.split(":");
            if (parts.length === 2) {
              lang = parts[0];
              title = parts[1];
            }
          }

          if (title) {
            fetchSummary(title, lang, latlng).catch(() => {
              console.warn("❌ No Wikipedia summary found.");
            });
          } else if (props.name) {
            const search = encodeURIComponent(props.name);
            fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${search}&format=json&origin=*`)
              .then((res) => res.json())
              .then((data: WikipediaSearchResult) => {
                const results = data.query?.search;
                if (results && results.length > 0) {
                  const bestMatch = results[0].title;
                  return fetchSummary(bestMatch, lang, latlng);
                } else {
                  throw new Error("No search results");
                }
              })
              .catch(() => {
                console.warn("❌ Could not fetch Wikipedia summary.");
              });
          }
        }
      });

      map.fitBounds(L.geoJSON(geojson).getBounds());
    })
    .catch((err) => {
      console.error(err);
    });
}

// Function to add a legend to the map
function addLegendToMap(map: L.Map, legendItems: { color: string, name: string, type?: 'line' | 'fill' | 'marker' }[]): void {
  const legend = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'info legend');
      const labels: string[] = [];

      // Loop through the items and create a label with a symbol for each
      legendItems.forEach(item => {
        let symbolHtml = "";

        if (item.type === 'marker') {
          const iconUrl = './node_modules/leaflet/dist/images/marker-icon.png';

          // Example marker symbol using the default Leaflet icon
          symbolHtml = `<img src="${iconUrl}" style="width: 12px; height: 20px; margin-right: 8px; vertical-align: middle;" />`;
        } else {
          // Default square symbol for lines and fill areas
          symbolHtml = `<i style="background:${item.color}; width: 12px; height: 12px; display: inline-block; margin-right: 8px; vertical-align: middle;"></i>`;
        }

        labels.push(
          `${symbolHtml} ${item.name}`
        );
      });

      div.innerHTML = labels.join('<br>');
      return div;
    }
  });

  map.addControl(new legend());
}

// Define legend items
const legendItems: { color: string, name: string, type: 'line' | 'fill' | 'marker' }[] = [
  { color: "#e74c3c", name: "Zoo Begrenzung", type: 'line' },
  { color: "#3498db", name: "Stadtgartengewässer", type: 'fill' },
  { color: "#F0DB4F", name: "Gebäude", type: 'fill' },
  { color: "#FF5733", name: "Tiere", type: 'marker' }
];

// Add legend to the map
addLegendToMap(map, legendItems);


// Load three GeoJSON files with different colors
loadSimpleLayer("../data/zoo_boundary.geojson", "#e74c3c", 0); // red
loadSimpleLayer("../data/water_body.geojson", "#3498db", 1);   // blue
loadSimpleLayer("../data/zoo_buildings.geojson", "#F0DB4F", 1) // yellow
loadAnimalInfo("../data/only_animals.geojson", "#2ecc71"); // green
