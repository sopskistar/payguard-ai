import Link from 'next/link';
import report from '../../docs/evidence/learning-report.json';
import before from '../../docs/evidence/learning-before.json';
export function LearningReport() {
  return (
    <section className="proof-section" id="learning">
      <span className="site-eyebrow">MEASURED LEARNING · REAL RECALL, SYNTHETIC CASES</span>
      <h2>A useful memory should improve the review.</h2>
      <p>
        Run at {new Date(report.checkedAt).toUTCString()}. Four actual SDK recalls were reused
        across 18 authored scenarios to limit provider quota. All memory candidates came from
        confirmed owner records; no writes were made.
      </p>
      <div className="proof-metrics">
        <div>
          <strong>
            {report.metrics.correct}/{report.metrics.cases}
          </strong>
          <span>specified decision and provenance checks met</span>
        </div>
        <div>
          <strong>
            {report.metrics.controlsWithAddedCritical}/{report.metrics.controls}
          </strong>
          <span>unchanged controls gained a critical false alarm</span>
        </div>
        <div>
          <strong>{report.metrics.staleOrWrongScopeApplied}</strong>
          <span>stale or wrong-scope policies applied</span>
        </div>
      </div>
      <p>
        The first run exposed {before.metrics.controlsWithAddedCritical} unnecessary recipient
        warnings on established destinations with sparse invoice history. The corrected engine
        checks the established supplier reference before adding a learned address warning. The same
        live-recall evaluation then met {report.metrics.correct} of {report.metrics.cases} contracts
        while preserving every baseline finding.
      </p>
      <p>
        Memory OFF keeps the mandatory approval holds. Memory ON added applicable policy context in{' '}
        {report.metrics.scenariosWithAppliedMemory} cases. {report.metrics.successfulRecalls}/
        {report.metrics.recallQueries} live queries returned confirmed candidates. Only{' '}
        {(report.metrics.applicableCitationFraction * 100).toFixed(1)}% of returned candidate/case
        combinations were applicable; broad retrieval still requires scope filtering. These numbers
        do not measure real-world fraud accuracy or prove ranking quality.
      </p>
      <details>
        <summary>Inspect every scenario and outcome</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Synthetic scenario</th>
                <th>Baseline → learned priority</th>
                <th>Approval gate</th>
                <th>Citations</th>
                <th>Contract</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.supplier}
                    <br />
                    {r.scenario}
                  </td>
                  <td>
                    {r.baseline} → {r.learned}
                  </td>
                  <td>{r.actualApprovalAllowed ? 'Review may be approved' : 'Hold remains'}</td>
                  <td>{r.applied}</td>
                  <td>{r.correct ? 'Met' : 'Failed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p>
        Exceptions use synthetic human attestations. The supersession case alters local evaluation
        input and leaves provider records intact. Contradictory instruction and invoice-scoped rules
        also have reproducible unit regressions.
      </p>
      <p>
        <a href="https://github.com/sopskistar/payguard-ai/blob/main/docs/evidence/learning-report.json">
          Raw measured results ↗
        </a>{' '}
        ·{' '}
        <a href="https://github.com/sopskistar/payguard-ai/blob/main/docs/evidence/learning-before.json">
          Initial failing run ↗
        </a>{' '}
        · <Link href="/try">Try the remembered-rule journey ↗</Link>
      </p>
    </section>
  );
}
