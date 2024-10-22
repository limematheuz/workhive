using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.TaskItem
{
    public class TaskItemUpdateDto
    {
        [Required(ErrorMessage = "The task name is required")]
        [StringLength(100, ErrorMessage = "The task name cannot exceed 100 characters")]
        public string Name { get; set; }

        [StringLength(500, ErrorMessage = "The description cannot exceed 500 characters")]
        public string Description { get; set; }

        [Required(ErrorMessage = "The date is required")]
        public DateTime Date { get; set; }

        [Required(ErrorMessage = "The start time is required")]
        public DateTime StartTime { get; set; }

        [Required(ErrorMessage = "The end time is required")]
        public DateTime EndTime { get; set; }

        [Required(ErrorMessage = "The status is required")]
        [StringLength(50, ErrorMessage = "The status cannot exceed 50 characters")]
        public string Status { get; set; }

        [Required(ErrorMessage = "Completion status is required")]
        [StringLength(10, ErrorMessage = "The completion status cannot exceed 10 characters")]
        public string IsCompleted { get; set; }

        public int UserId { get; set; } // Relación con User
        public string UserName { get; set; } // Nombre del usuario
        public int LocationId { get; set; } // Relación con Location
        public string LocationAddress { get; set; } // Dirección de la ubicación
        public int CompanyId { get; set; } // Relación con Company
        public string CompanyName { get; set; } // Nombre de la empresa
    }
}