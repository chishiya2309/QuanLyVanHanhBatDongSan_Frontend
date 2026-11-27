export function FinancePending({ error, retry, label }: { error?: string; retry: () => void; label: string }) {
  return error ? <div className="finance-error" role="alert"><p>{error}</p>
    <button type="button" onClick={retry}>Thử lại</button></div>
    : <div className="finance-loading" role="status" aria-busy="true"><p>{label}</p>
      <div className="finance-placeholder" aria-hidden="true" /></div>;
}

