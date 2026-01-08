function Footer() {
  const year = new Date().getFullYear()
  
  return (
    <footer className="app-footer">
      <div className="float-end d-none d-sm-inline">
        React + Express
      </div>
      <strong>
        Copyright © {year} <a href="#">Tu Empresa</a>.
      </strong> Todos los derechos reservados.
    </footer>
  )
}

export default Footer
