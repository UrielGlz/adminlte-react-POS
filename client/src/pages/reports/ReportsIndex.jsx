import { Link } from 'react-router-dom'

function ReportsIndex() {
  const reports = [
    {
      id: 'customers',
      title: 'Customers List',
      description: 'Complete list of customers with credit status and account details',
      icon: 'bi-people',
      color: 'primary',
      path: '/reports/customers',
      category: 'Operations'
    },
    {
      id: 'sales',
      title: 'Sales Report',
      description: 'All transactions with customer and driver details',
      icon: 'bi-receipt',
      color: 'success',
      path: '/reports/sales',
      category: 'Sales'
    },
    {
      id: 'customer-statement',
      title: 'Customer Statement',
      description: 'Account summary and transaction history per customer',
      icon: 'bi-person-lines-fill',
      color: 'primary',
      path: '/reports/customer-statement',
      category: 'Sales'
    },
    {
      id: 'cash-sales',
      title: 'Cash Sales',
      description: 'Transactions without customer account (walk-in / general public)',
      icon: 'bi-cash-stack',
      color: 'info',
      path: '/reports/cash-sales',
      category: 'Sales'
    },
    // Coming soon...
    {
      id: 'coming-soon-1',
      title: 'Driver Activity',
      description: 'Driver transactions and activity log',
      icon: 'bi-truck',
      color: 'secondary',
      path: null,
      category: 'Operations',
      comingSoon: true
    }
  ]

  const categories = [...new Set(reports.map(r => r.category))]

  return (
    <div className="container-fluid p-4">
      <div className="mb-4">
        <h3 className="mb-1">
          <i className="bi bi-file-earmark-bar-graph me-2"></i>
          Reports Center
        </h3>
        <p className="text-muted mb-0">Generate and export reports in PDF and Excel format</p>
      </div>

      {categories.map(category => (
        <div key={category} className="mb-4">
          <h5 className="text-muted mb-3 border-bottom pb-2">
            <i className="bi bi-folder me-2"></i>{category}
          </h5>
          <div className="row g-4">
            {reports.filter(r => r.category === category).map(report => (
              <div key={report.id} className="col-md-6 col-lg-4 col-xl-3">
                {report.comingSoon ? (
                  <div className="card h-100 border-dashed opacity-50">
                    <div className="card-body text-center py-4">
                      <div className={`display-4 text-${report.color} mb-3`}>
                        <i className={`bi ${report.icon}`}></i>
                      </div>
                      <h5 className="card-title">{report.title}</h5>
                      <p className="card-text text-muted small">{report.description}</p>
                      <span className="badge bg-secondary">Coming Soon</span>
                    </div>
                  </div>
                ) : (
                  <Link to={report.path} className="text-decoration-none">
                    <div className="card h-100 border-0 shadow-sm hover-shadow transition">
                      <div className="card-body text-center py-4">
                        <div className={`display-4 text-${report.color} mb-3`}>
                          <i className={`bi ${report.icon}`}></i>
                        </div>
                        <h5 className="card-title text-dark">{report.title}</h5>
                        <p className="card-text text-muted small">{report.description}</p>
                        <div className="mt-3">
                          <span className="badge bg-light text-dark me-2">
                            <i className="bi bi-file-pdf text-danger me-1"></i>PDF
                          </span>
                          <span className="badge bg-light text-dark">
                            <i className="bi bi-file-excel text-success me-1"></i>Excel
                          </span>
                        </div>
                      </div>
                      <div className={`card-footer bg-${report.color} text-white text-center py-2`}>
                        <small><i className="bi bi-arrow-right me-1"></i>Generate Report</small>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <style>{`
        .hover-shadow:hover { transform: translateY(-5px); box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important; }
        .transition { transition: all 0.3s ease; }
        .border-dashed { border: 2px dashed #dee2e6 !important; }
      `}</style>
    </div>
  )
}

export default ReportsIndex