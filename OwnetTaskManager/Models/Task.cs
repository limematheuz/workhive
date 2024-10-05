namespace OwnetTaskManager.Models;

public class Task
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; }
    public string IsCompleted { get; set; }
    
    // Relación con la entidad User
    public int UserId { get; set; }
    public User User { get; set; }
    
    // Relación con la entidad Location
    public int LocationId { get; set; }
    public Location Location { get; set; }
    
    // Relación con la entidad Company
    public int CompanyId { get; set; }
    public Company Company { get; set; }
}