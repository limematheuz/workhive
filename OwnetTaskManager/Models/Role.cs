using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.Models
{
    public class Role
    {
        [Key]
        public int Id { get; set; }

        [Required(ErrorMessage = "The role name is required")]
        [StringLength(50, ErrorMessage = "The role name cannot exceed 50 characters")]
        public string Name { get; set; } // Nombre del rol, por ejemplo: Admin, User, etc.

        public ICollection<User> Users { get; set; } // Relación con usuarios que tienen este rol
    }
}