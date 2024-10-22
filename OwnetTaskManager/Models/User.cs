using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Password is required")]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
        public string PasswordHash { get; set; }

        // Relación con la empresa
        [Required(ErrorMessage = "CompanyId is required")]
        public int CompanyId { get; set; }

        public Company Company { get; set; }

        // Relación con el rol
        [Required(ErrorMessage = "RoleId is required")]
        public int RoleId { get; set; }

        public Role Role { get; set; }

        public ICollection<TaskItem> TaskItems { get; set; }
    }
}