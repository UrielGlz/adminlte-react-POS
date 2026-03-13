function Footer() {
  const year = new Date().getFullYear()
  
  return (
    <footer className="app-footer">
     
      <strong>
        Copyright © {year} <a href="#">McAllen Foreign Trade Zone</a>.
      </strong> All rights reserved.
    </footer>
  )
}

export default Footer
