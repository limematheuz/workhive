using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OwnetTaskManager.Models;

public class TaskItem
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; }
    public string IsCompleted { get; set; }
    
    // Relación con la entidad User
    [ForeignKey("UserId")]
    public int UserId { get; set; }
    public User User { get; set; }
    
    // Relación con la entidad Location
    [ForeignKey("LocationId")]
    public int LocationId { get; set; }
    public Location Location { get; set; }
    
    // Relación con la entidad Company
    [ForeignKey("CompanyId")]
    public int CompanyId { get; set; }
    public Company Company { get; set; }
}