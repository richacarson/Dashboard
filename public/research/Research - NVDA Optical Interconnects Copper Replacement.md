
# NVDA Optical Interconnects — Copper Replacement Play

## Thesis

NVIDIA is making a structural bet that optical interconnects will replace copper as the backbone of AI data center networking. On March 2, 2026, NVIDIA committed $4 billion — $2B each to Coherent (COHR) and Lumentum (LITE) — in equity investments plus multibillion-dollar purchase commitments to secure silicon photonics and co-packaged optics (CPO) supply. This is not incremental. NVIDIA is signaling that copper has hit its physical ceiling for GPU-to-GPU communication at scale, and that photonics is now a structural requirement for next-generation AI factories. The optical interconnect market is projected to grow from ~$19B (2025) to ~$40B (2031), with co-packaged optics alone expected to exceed $20B by 2036.

The Social Arbitrage angle is compelling: Wall Street spent 2024-2025 focused on the "compute wars" (GPU scarcity). 2026 has become the year of the "interconnect bottleneck." The market is just now repricing the optical supply chain — LITE is up 1,045% in one year, COHR up 292%, CIEN up 351%. The question is whether the repricing is complete or whether the multi-year CPO buildout creates sustained upside.

## Background

### Why Copper Is Hitting Its Limits

Traditional copper interconnects face hard physics constraints as AI clusters scale:

- **Bandwidth ceiling:** NVLink 6 defines 400G SerDes per lane as peak transmission — at these speeds, electrical signals over copper degrade rapidly beyond ~1 meter.
- **Current state:** NVIDIA's DGX GB200 NVL72 rack contains over 2 miles of NVLink copper cables, delivering 7.2 Tbit/s per GPU (soon 14.4 Tbit/s in Rubin generation). But copper-based links are limited to two meters max, constraining scale-up to one or two racks.
- **Power problem:** In modern AI clusters, data movement consumes up to half of total system energy. As speeds push beyond 800G, copper faces higher resistance, greater signal loss, and rising thermal constraints.
- **Density problem:** Modern AI factory topologies relocate Tier 1 switches to end-of-row, dramatically increasing distances between servers and switches — distances copper cannot serve.

### What NVIDIA Is Building

NVIDIA's optical strategy spans three product families and a multi-year roadmap:

**Products (announced at GTC 2025):**

| Product | Protocol | Throughput | Ports | Timeline |
|---|---|---|---|---|
| Quantum-X Photonics | InfiniBand | 115 Tb/s | 144 x 800G | Early 2026 |
| Spectrum-X Photonics | Ethernet | 100-400 Tb/s | 128-512 x 800G | H2 2026 |

**Technology approach:**
- **Co-Packaged Optics (CPO):** Optical engines integrated directly onto the switch ASIC, replacing legacy pluggable transceivers. Built on TSMC's COUPE 3D packaging (System on Integrated Chips).
- **External Light Source (ELS) modules:** Centralize laser generation, reducing total lasers in the data center by 4x vs. legacy designs. Fewer lasers = lower cost, lower failure rates.
- **Silicon photonics die:** 200G PAM4 micro-ring modulators (MRMs) on silicon photonics die for bandwidth density in compact form factor.

**Performance gains over legacy pluggable optics:**
- 3.5x more power efficient
- 63x greater signal integrity
- 10x better network resiliency at scale
- 4x fewer lasers required

**Roadmap:**

| Year | Platform | Optical Milestone |
|---|---|---|
| 2026 | Vera Rubin | Spectrum-X CPO + NVLink-6 switch rollout |
| 2027 | Rubin Ultra | Kyber NVL144 (144 GPU packages, 4x current perf) |
| 2028 | Feynman | First NVIDIA platform with NVLink CPO switches; optical NVLink enables 576-1,152 GPU scale-up |

**$4B supply chain investment (March 2, 2026):**
- $2B equity + purchase commitments to **Coherent Corp (COHR)** — advanced laser and optical components
- $2B equity + purchase commitments to **Lumentum Holdings (LITE)** — EML lasers and photonic components
- Both deals are nonexclusive but include future capacity access rights
- Funds support U.S.-based manufacturing buildout

### Industry-Wide Momentum

- **OCI MSA (Optical Compute Interconnect Multi-Source Agreement):** NVIDIA, AMD, Broadcom, OpenAI, Meta, and Microsoft formed an alliance to standardize protocol-agnostic optical interconnects for AI data centers.
- **Marvell acquired Celestial AI** (Dec 2025, completed Feb 2026) for $3.25B-$5.5B — a "Photonic Fabric" technology delivering 16 Tbit/s per chiplet, 10x current state-of-the-art.
- **Broadcom** moved into volume production of Tomahawk 6-Davisson — the world's first 102.4 Tbps Ethernet switch with integrated CPO.
- **1.6T transceiver supercycle:** Shipments expected to scale from 2.5M units (2025) to 20M+ units by end of 2026.

## Key Players — Public Companies (>1M Avg Daily Volume)

### Tier 1: Direct NVIDIA Supply Chain Partners

| Ticker | Company | Mkt Cap | Avg Daily Vol | Role in Optical Interconnect |
|---|---|---|---|---|
| **COHR** | Coherent Corp | ~$48B | ~12M | Received $2B NVDA investment. Laser sources, optical engines, silicon photonics components. Vertically integrated from InP wafers to packaged transceivers. |
| **LITE** | Lumentum Holdings | ~$50B | ~8.5M | Received $2B NVDA investment. Only supplier shipping 200G-per-lane EMLs at volume — the critical component for 1.6T transceivers. Added to S&P 500 (Mar 2026). |

### Tier 2: CPO / Silicon Photonics Infrastructure

| Ticker | Company | Mkt Cap | Avg Daily Vol | Role in Optical Interconnect |
|---|---|---|---|---|
| **AVGO** | Broadcom | ~$1.5T | ~15M+ | Tomahawk 6-Davisson: first 102.4 Tbps switch with integrated CPO. PAM4 DSPs. Most aggressive CPO advocate among semis. |
| **MRVL** | Marvell Technology | ~$80B | ~20M+ | Acquired Celestial AI ($3.25-5.5B) for Photonic Fabric. First to market with 1.6T PAM DSPs (5nm and 3nm). Expects interconnect biz to grow 50%+ in FY27. |
| **NVDA** | NVIDIA | ~$2.8T | ~200M+ | Designing CPO switches (Quantum-X, Spectrum-X Photonics). Vertical integration into networking silicon photonics. |

### Tier 3: Optical Component & Transceiver Makers

| Ticker | Company | Mkt Cap | Avg Daily Vol | Role in Optical Interconnect |
|---|---|---|---|---|
| **MTSI** | MACOM Technology | ~$18B | ~2M+ | High-speed analog and photonic semiconductors. TIAs, drivers, CDRs for 800G/1.6T transceivers. Targeting 35-40% data center revenue growth. |
| **AAOI** | Applied Optoelectronics | ~$7B | ~8M+ | Vertically integrated transceiver maker with U.S. manufacturing (Texas). Secured $200M order for 1.6T product line (Mar 2026). Stock up 798% YoY. |
| **FN** | Fabrinet | ~$20B | ~723K | **Below 1M volume threshold — borderline.** Contract manufacturer for optical transceivers. Makes components for LITE, COHR, and others. Critical supply chain node. |

### Tier 4: Networking & Coherent Optics

| Ticker | Company | Mkt Cap | Avg Daily Vol | Role in Optical Interconnect |
|---|---|---|---|---|
| **CIEN** | Ciena | ~$57B | ~5M+ | Coherent optical networking leader. Integrating high-capacity coherent tech into shorter-reach data center market. Revenue up 33% YoY in Q1 FY2026. |
| **CSCO** | Cisco Systems | ~$250B | ~15M+ | Acquired Acacia Communications (silicon photonics). Pluggable coherent optics for data center interconnect. |
| **NOK** | Nokia | ~$30B | ~5M+ | Racing with Ciena to bring coherent technology into data center short-reach. |
| **INTC** | Intel | ~$100B | ~40M+ | CMOS-based silicon photonics R&D. Investor in Ayar Labs. Slower to commercialize but holds foundational IP. |

### Notable Private Companies (Potential IPO/Acquisition Targets)

| Company | Valuation | Status | Technology |
|---|---|---|---|
| **Lightmatter** | $4.4B | IPO signals (hired ex-NVDA IR head as CFO) | 3D photonic interposer (Passage M1000). 114 Tbps bandwidth. |
| **Ayar Labs** | $1B+ | Backed by NVDA, AMD, INTC | Optical I/O chiplets on processor substrate. 100+ Tbps per accelerator demonstrated. |

## Copper Demand Implications

### The Nuanced Reality

The optical-replaces-copper narrative is real but more complex than headlines suggest. The impact on copper demand is bifurcated:

**Where copper LOSES share (interconnects):**
- GPU-to-GPU scale-up links beyond 2 meters
- Switch-to-server connections (moving to optical as distances increase)
- Top-of-rack to end-of-row switch connections
- Scale-out fabric in AI factories
- As CPO matures through 2028, optical penetration in AI data center modules could reach 35% by 2030 (TrendForce)

**Where copper RETAINS its role:**
- **Power delivery:** Busbars, power distribution, electrical connectors — fiber cannot carry power
- **Very short-reach connections:** Sub-1 meter intra-rack links where copper is cheaper, zero-power, and reliable
- **Grid infrastructure:** Substations, transformers, building wiring for the data centers themselves
- **Cooling systems:** Copper heat exchangers and cooling infrastructure

**Net copper demand outlook:**
- Data center copper demand is still projected to grow significantly: from ~1.1M metric tons (2025) to 1.1-2.5M metric tons by 2030 (estimates vary widely by source)
- A single hyperscale AI data center can consume 15,000-50,000 tons of copper
- Even as optical replaces copper in interconnects, the sheer volume of new data center construction drives net copper demand higher
- S&P Global acknowledges that the fiber optics shift "could result in a decline of overall copper intensity in data centers" — but the number of data centers is growing faster than intensity is declining
- UBS forecasts copper supply deficits of 230,000 tonnes (2025) and 400,000+ tonnes (2026) from mine disruptions colliding with rising demand

**Bottom line for the copper thesis:** The optical transition is a headwind to copper *intensity per data center* but is not a near-term headwind to aggregate copper *demand*. The buildout of AI data center capacity is so massive that copper demand from power delivery and construction overwhelms the interconnect substitution effect through at least 2030. Long-term (2030+), if CPO becomes ubiquitous and data center build rates plateau, the copper intensity decline could begin to bite.

## IOWN Portfolio Cross-Reference

### Direct Exposure — Currently Held

| Ticker | Portfolio | Relevance |
|---|---|---|
| **NVDA** | Growth | **Central player.** $4B photonics investment, designing CPO switches, vertical integration into optical networking. This research note is fundamentally about NVDA's strategic direction. |
| **AMD** | Growth | **High relevance.** OCI MSA member. UALink competitor to NVLink will use same optical infrastructure. AMD invested in Ayar Labs. AMD benefits from industry-wide optical standards. |
| **TSM** | Growth | **Critical enabler.** TSMC's COUPE 3D packaging technology is the manufacturing backbone for NVIDIA's CPO switches. TSMC builds the silicon photonics dies. Every player in this space depends on TSMC. |
| **NXPI** | Growth | **Moderate relevance.** NXP has high-speed connectivity and mixed-signal expertise applicable to photonic interfaces, though not a primary player in data center optics. |
| **KEYS** | Growth | **Moderate relevance.** Keysight provides test and measurement equipment essential for validating 800G/1.6T optical interconnects. Every transceiver maker needs Keysight gear. |
| **QCOM** | Dividend | **Low-moderate relevance.** Qualcomm works with Lightmatter on photonic substrates. Peripheral exposure. |
| **ADI** | Dividend | **Low-moderate relevance.** Analog Devices makes high-speed data converters and signal processing components used in optical systems. |
| **LRCX** | Dividend | **Indirect relevance.** Lam Research provides etch and deposition equipment for semiconductor manufacturing, including silicon photonics wafer processing. |
| **TEL** | Dividend | **Indirect relevance.** TE Connectivity makes connectors and interconnect solutions — exposed to both sides of the copper-to-optical transition. Worth monitoring for product mix shift. |
| **STLD** | Dividend | **Copper theme tangent.** Steel Dynamics is a metals play. Not directly relevant to optical interconnects, but the broader critical metals theme applies. |

### Not Held — Worth Watching

The highest-conviction names in the optical supply chain that IOWN does NOT currently hold:

| Ticker | Why It Matters | Consideration |
|---|---|---|
| **COHR** | Direct $2B NVDA investment. Vertically integrated photonics. ~$48B cap. | Strong candidate for Growth sleeve |
| **LITE** | Direct $2B NVDA investment. Only volume 200G EML supplier. ~$50B cap. S&P 500 addition. | Strong candidate for Growth sleeve |
| **MRVL** | Celestial AI acquisition. 1.6T PAM DSP leader. ~$80B cap. | Strong candidate — custom silicon + photonics |
| **AVGO** | CPO switch leader. Dominant networking silicon. ~$1.5T cap. | Large cap, diversified, strong AI exposure |

## Risks

1. **Execution risk on CPO timeline.** NVIDIA's CPO roadmap extends to 2028 for full optical NVLink. Delays in TSMC's COUPE packaging or silicon photonics die yields could push timelines. The history of CPO is one of perpetual "2 years away."

2. **Copper fights back.** Co-Packaged Copper (CPC) is emerging as a transitional architecture that could extend copper's relevance in short-reach applications, delaying optical adoption. NVIDIA's own Jensen Huang has said: "We should stay with copper for as long as we can."

3. **Valuation.** The optical supply chain has repriced violently — LITE up 1,045% YoY, COHR up 292%, AAOI up 798%. Much of the 2026-2027 growth may already be priced in. A demand air pocket or hyperscaler CapEx slowdown would hit these names hard.

4. **Concentration risk.** NVIDIA's $4B investment in COHR and LITE, while nonexclusive, deepens the AI infrastructure stack's dependence on NVIDIA. Regulatory scrutiny of NVIDIA's vertical integration is rising.

5. **Alternative technologies.** RF-over-plastic waveguides (e.g., from Point2 Technology) claim 10x cable reach at 3x lower cost than optical. Early stage but worth monitoring as a disruptive dark horse.

6. **Private company disruption.** Lightmatter ($4.4B valuation) and Ayar Labs ($1B+) hold potentially superior technology. If either IPOs or gets acquired into a competitor, the competitive landscape shifts.

7. **China risk.** Chinese hyperscalers are building independent optical supply chains. Export controls could fragment the market and create parallel ecosystems.

## Next Steps

- [ ] **Committee discussion (next Tuesday):** Present optical interconnect thesis and discuss whether COHR, LITE, or MRVL warrant position sizing for Growth sleeve
- [ ] **Deep dive on COHR vs. LITE:** Both received identical $2B NVDA investments, but LITE appears to have the stronger near-term moat (sole volume 200G EML supplier). Need to compare valuations, margin profiles, and customer concentration
- [ ] **MRVL deep dive:** Celestial AI acquisition gives them a differentiated angle (Photonic Fabric vs. traditional CPO). $80B market cap with 50%+ interconnect growth guided — potentially better risk/reward than $50B LITE
- [ ] **Monitor Lightmatter IPO signals:** CFO hire from NVIDIA IR is a classic pre-IPO move. Could be a 2026-2027 event. If it prices well, it's a pure-play optical bet
- [ ] **Reassess copper theme:** The optical transition doesn't kill the copper bull case near-term (power delivery demand overwhelms interconnect substitution), but copper intensity per data center is declining. Factor this into any copper/critical metals positioning
- [ ] **Track 1.6T transceiver shipment data quarterly:** The 2.5M to 20M+ unit ramp (2025-2026) is the key demand signal for the entire supply chain
- [ ] **Check Inspire screening:** Verify COHR, LITE, MRVL, and AVGO pass faith-driven screens before any position recommendation

---

*Sources: NVIDIA Newsroom, Tom's Hardware, HPCwire, Futurum Group, TrendForce, S&P Global, SDxCentral, IEEE Spectrum, Yahoo Finance, CNBC, Marvell Investor Relations, Network World, NVIDIA Developer Blog. Data as of March 28, 2026.*
