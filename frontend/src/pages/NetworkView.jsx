import { useEffect, useState } from "react";
import SectionHeading from "../components/atoms/SectionHeading.jsx";
import Button from "../components/atoms/Button.jsx";
import NetworkCluster from "../components/organisms/NetworkCluster.jsx";
import { fetchNetworkGraph } from "../api/devices.js";

export default function NetworkView() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async ({ showSpinner = true } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const response = await fetchNetworkGraph();
      setNetworks(response.networks || []);
      setError(null);
    } catch (err) {
      setError(err.message || "Unable to load network information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section>
      <SectionHeading
        title="Network view"
        actions={
          <Button onClick={() => load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />
      {error ? <div className="empty-state">{error}</div> : null}
      {!error && loading ? <div className="empty-state">Loading network map…</div> : null}
      {!loading && !error && !networks.length ? (
        <div className="empty-state">No devices with network data yet.</div>
      ) : null}
      <div className="network-grid">
        {networks.map((cluster) => (
          <div key={cluster.gateway.id} className="network-grid__item">
            <NetworkCluster cluster={cluster} />
          </div>
        ))}
      </div>
    </section>
  );
}
