import React, { useState, useRef, useCallback } from 'react';

// ─── Utils ────────────────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function reduction(orig, final) {
  if (!orig || !final) return null;
  const pct = ((orig - final) / orig) * 100;
  return pct;
}

// ─── Componentes menores ───────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

function Steps({ step }) {
  const steps = [
    { label: 'Upload' },
    { label: 'Configurar' },
    { label: 'Converter' },
    { label: 'Download' },
  ];
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={i} className={`step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
          <span className="step-num">{step > i + 1 ? '✓' : i + 1}</span>
          {s.label}
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles]       = useState([]);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions]   = useState({
    format: 'webp',
    quality: 85,
    keepOriginal: false,
    keepExif: false,
    forceSquare: false,
  });
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults]   = useState(null);
  const [error, setError]       = useState(null);
  const [batchId, setBatchId]   = useState(null);
  const inputRef = useRef();

  const currentStep = results ? 4 : loading ? 3 : files.length > 0 ? 2 : 1;

  // ─── File handling ──────────────────────────────────────────────────────────
  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const deduped = valid.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...deduped.map(f => ({ file: f, preview: URL.createObjectURL(f) }))];
    });
    setResults(null);
    setError(null);
  }, []);

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ─── Convert ────────────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!files.length) return;
    setLoading(true);
    setProgress(10);
    setError(null);

    const fd = new FormData();
    files.forEach(({ file }) => fd.append('images', file));
    fd.append('options', JSON.stringify(options));

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 60) + 10);
      }
    };

    xhr.onload = () => {
      setProgress(100);
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setBatchId(data.batchId);
          setResults(data.results);
        } catch {
          setError('Erro ao processar resposta do servidor.');
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setError(err.error || 'Erro ao converter imagens.');
        } catch {
          setError(`Erro ${xhr.status}`);
        }
      }
      setLoading(false);
    };

    xhr.onerror = () => {
      setError('Erro de conexão com o servidor.');
      setLoading(false);
    };

    xhr.open('POST', '/api/convert');
    xhr.send(fd);
  };

  // ─── Stats globais ──────────────────────────────────────────────────────────
  let totalFiles = 0, totalOrigSize = 0, totalConvSize = 0;
  if (results) {
    for (const versions of Object.values(results)) {
      totalFiles += versions.length;
      if (versions[0]) {
        totalOrigSize += versions[0].origSize || 0;
        for (const v of versions) totalConvSize += v.size || 0;
      }
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <div className="logo">
              <div className="logo-icon">⚡</div>
              <div>
                ImageForge
                <div className="logo-sub">Conversor &amp; Otimizador</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Steps step={currentStep} />

          {/* Error */}
          {error && (
            <div className="error-box">⚠ {error}</div>
          )}

          {/* Upload Zone */}
          {!results && !loading && (
            <>
              <div
                className={`dropzone ${dragging ? 'active' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="dropzone-input"
                  onChange={e => addFiles(e.target.files)}
                />
                <span className="dropzone-icon">🖼️</span>
                <div className="dropzone-title">
                  {dragging ? 'Solte aqui!' : 'Arraste imagens ou clique para selecionar'}
                </div>
                <div className="dropzone-sub">
                  JPG, PNG, WebP, AVIF, GIF, TIFF, BMP, HEIC · Máx. 25MB por arquivo
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="file-list" style={{ marginTop: 16 }}>
                  {files.map(({ file, preview }, i) => (
                    <div key={i} className="file-item">
                      <img className="file-thumb" src={preview} alt="" />
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{fmtBytes(file.size)}</div>
                      </div>
                      <button className="file-remove" onClick={() => removeFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Options */}
          {files.length > 0 && !results && !loading && (
            <>
              <hr className="divider" />
              <div className="section-label">Configurações</div>
              <div className="section-title">Como converter?</div>

              <div className="options-grid">
                {/* Formato */}
                <div className="option-card">
                  <div className="option-label">Formato de saída</div>
                  <div className="option-title">Tipo de arquivo</div>
                  <div className="format-buttons">
                    {['webp', 'avif', 'jpeg', 'png'].map(f => (
                      <button
                        key={f}
                        className={`fmt-btn ${options.format === f ? 'selected' : ''}`}
                        onClick={() => setOptions(o => ({ ...o, format: f }))}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                    {options.format === 'webp' && 'WebP: ótimo balanço qualidade/tamanho (recomendado)'}
                    {options.format === 'avif' && 'AVIF: menor tamanho, processamento mais lento'}
                    {options.format === 'jpeg' && 'JPEG: máxima compatibilidade'}
                    {options.format === 'png' && 'PNG: sem perdas, maior arquivo'}
                  </div>
                </div>

                {/* Qualidade */}
                {options.format !== 'png' && (
                  <div className="option-card">
                    <div className="option-label">Compressão</div>
                    <div className="option-title">Qualidade</div>
                    <div className="quality-row">
                      <input
                        type="range"
                        className="quality-slider"
                        min={10}
                        max={100}
                        value={options.quality}
                        onChange={e => setOptions(o => ({ ...o, quality: +e.target.value }))}
                      />
                      <span className="quality-value">{options.quality}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                      {options.quality >= 85 ? '🟢 Alta qualidade' :
                        options.quality >= 60 ? '🟡 Qualidade média' : '🔴 Alta compressão'}
                    </div>
                  </div>
                )}

                {/* Opções adicionais */}
                <div className="option-card">
                  <div className="option-label">Opções</div>
                  <div className="option-title">Comportamento</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="toggle-row">
                      <span className="toggle-label">Manter original + 5 tamanhos</span>
                      <Toggle id="keepOrig" checked={options.keepOriginal}
                        onChange={v => setOptions(o => ({ ...o, keepOriginal: v }))} />
                    </div>
                    <div className="toggle-row">
                      <span className="toggle-label">Manter dados EXIF</span>
                      <Toggle id="keepExif" checked={options.keepExif}
                        onChange={v => setOptions(o => ({ ...o, keepExif: v }))} />
                    </div>
                    <div className="toggle-row">
                      <span className="toggle-label">Forçar quadrado (crop)</span>
                      <Toggle id="forceSquare" checked={options.forceSquare}
                        onChange={v => setOptions(o => ({ ...o, forceSquare: v }))} />
                    </div>
                  </div>
                </div>

                {/* Tamanhos gerados */}
                <div className="option-card">
                  <div className="option-label">Tamanhos automáticos</div>
                  <div className="option-title">5 versões por imagem</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['2560px', '1920px', '1280px', '768px', '480px'].map(s => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--accent)', fontSize: 11 }}>▸</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>proporção mantida</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleConvert}
                disabled={!files.length || loading}
                style={{ fontSize: 15, padding: '14px 32px' }}
              >
                ⚡ Converter {files.length} imagem{files.length > 1 ? 's' : ''}
              </button>
            </>
          )}

          {/* Loading */}
          {loading && (
            <div className="status-box">
              <span className="icon"><span className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} /></span>
              <h3>Processando imagens...</h3>
              <p style={{ marginBottom: 16 }}>Aguarde enquanto convertemos e redimensionamos seus arquivos.</p>
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div className="progress-bar-wrap" style={{ height: 8 }}>
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-label">
                  <span>Processando</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <>
              <div className="results-header">
                <div>
                  <div className="section-label">Concluído</div>
                  <div className="section-title" style={{ marginBottom: 0 }}>Resultados</div>
                </div>
                <div className="results-stats">
                  <div className="stat">
                    <div className="stat-value">{Object.keys(results).length}</div>
                    <div className="stat-label">Imagens</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{totalFiles}</div>
                    <div className="stat-label">Arquivos gerados</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value" style={{ color: 'var(--green)' }}>
                      {totalOrigSize > 0 ? `${Math.round(((totalOrigSize - totalConvSize) / totalOrigSize) * 100)}%` : '-'}
                    </div>
                    <div className="stat-label">Redução média</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a
                  className="btn btn-green"
                  href={`/api/download-zip/${batchId}`}
                  download
                >
                  📦 Baixar ZIP com tudo
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setResults(null); setFiles([]); setBatchId(null); setProgress(0); }}
                >
                  ↩ Nova conversão
                </button>
              </div>

              {Object.entries(results).map(([origName, versions]) => (
                <div key={origName} className="result-group">
                  <div className="result-group-header">
                    <span style={{ color: 'var(--accent)' }}>📄</span>
                    <span className="result-group-name">{origName}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                      Original: {fmtBytes(versions[0]?.origSize)} — {versions[0]?.origWidth}×{versions[0]?.origHeight}px
                    </span>
                  </div>
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>Versão</th>
                        <th>Dimensões</th>
                        <th>Tamanho</th>
                        <th>Redução</th>
                        <th>Formato</th>
                        <th>Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v, i) => {
                        const pct = reduction(v.origSize, v.size);
                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v.label}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                              {v.width}×{v.height}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtBytes(v.size)}</td>
                            <td>
                              {pct !== null && (
                                <span className={`size-reduction ${pct < 0 ? 'size-bigger' : ''}`}>
                                  {pct >= 0 ? `↓ ${pct.toFixed(0)}%` : `↑ ${Math.abs(pct).toFixed(0)}%`}
                                </span>
                              )}
                            </td>
                            <td><span className="badge badge-format">{v.format}</span></td>
                            <td>
                              <a
                                className="btn btn-ghost btn-small"
                                href={`/api/download/${batchId}/${v.filename}`}
                                download={v.filename}
                              >
                                ↓
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          ImageForge · Processamento no servidor · Arquivos deletados automaticamente
        </div>
      </footer>
    </div>
  );
}
