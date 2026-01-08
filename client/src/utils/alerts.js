import Swal from 'sweetalert2'

// Base config to match Bootstrap/AdminLTE look
const swal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    confirmButton: 'btn btn-primary',
    cancelButton: 'btn btn-default ms-2',
    denyButton: 'btn btn-danger',
    popup: 'swal2-popup',
  },
})

/**
 * Generic modal alert
 * type: 'success' | 'error' | 'warning' | 'info' | 'question'
 */
export const showAlert = ({ type = 'info', title = 'Notice', text = '' }) => {
  return swal.fire({ icon: type, title, text })
}

/**
 * Generic toast
 */
export const showToast = ({ type = 'success', title = 'Done', text = '' }) => {
  return swal.fire({
    toast: true,
    position: 'top-end',
    icon: type,
    title,
    text,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  })
}

/**
 * Generic confirm dialog (returns boolean)
 */
export const confirmAction = async ({
  title = 'Are you sure?',
  text = 'This action cannot be undone.',
  confirmText = 'Yes, continue',
  cancelText = 'Cancel',
  type = 'warning',
} = {}) => {
  const res = await swal.fire({
    icon: type,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  })

  return !!res.isConfirmed
}
