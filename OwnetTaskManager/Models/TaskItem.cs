using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OwnetTaskManager.Models;

public class TaskItem
{
    [Key] public int Id { get; set; }

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

    // Relación con la entidad User
    [ForeignKey("UserId")]
    [Required(ErrorMessage = "The user ID is required")]
    public int UserId { get; set; }

    public User User { get; set; }

    // Relación con la entidad Location
    [ForeignKey("LocationId")]
    [Required(ErrorMessage = "The location ID is required")]
    public int LocationId { get; set; }

    public Location Location { get; set; }

    // Relación con la entidad Company
    [ForeignKey("CompanyId")]
    [Required(ErrorMessage = "The company ID is required")]
    public int CompanyId { get; set; }

    public Company Company { get; set; }
}