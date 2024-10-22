using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.Role
{
    public class RoleDto
    {
        [Required(ErrorMessage = "The role name is required")]
        [StringLength(50, ErrorMessage = "The role name cannot exceed 50 characters")]
        public string Name { get; set; }
    }
}