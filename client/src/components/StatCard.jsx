function StatCard({ title, value, icon, color = 'primary', footer = 'Más info' }) {
  return (
    <div className={`small-box text-bg-${color}`}>
      <div className="inner">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
      <svg 
        className="small-box-icon" 
        fill="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <i className={`bi ${icon}`} style={{ fontSize: '70px' }}></i>
      </svg>
      <a href="#" className="small-box-footer link-light link-underline-opacity-0 link-underline-opacity-50-hover">
        {footer} <i className="bi bi-link-45deg"></i>
      </a>
    </div>
  )
}

export default StatCard
